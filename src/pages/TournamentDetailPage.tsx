import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type CSSProperties, Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { matchService } from '@/services/matchService';
import type {
  FootballMatch,
  RenjuMatch,
  StandingsZone,
  TiebreakerKey,
  TournamentItem,
} from '@/types/match';
import {
  computeFootballStandings,
  computeStandings,
  type StandingEntry,
} from '@/utils/standings';

const TIEBREAKER_HEADER: Record<TiebreakerKey, string> = {
  buchholz: '对手分',
  median_buchholz: '中间对手分',
  wins: '胜局数',
};

function getTiebreakerValue(row: StandingEntry, key: TiebreakerKey): number {
  if (key === 'buchholz') return row.buchholz;
  if (key === 'median_buchholz') return row.medianBuchholz;
  return row.tiebreakWins;
}

function formatScheduleLines(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const time = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return { date, time };
}

function getDisplayScores(match: RenjuMatch): {
  blackText: string;
  whiteText: string;
  blackOutcome: 'win' | 'draw' | 'loss' | null;
} {
  if (!match.result) {
    return { blackText: '-', whiteText: '-', blackOutcome: null };
  }
  if (match.result === '+') {
    return { blackText: '+', whiteText: '-', blackOutcome: 'win' };
  }
  if (match.result === '-') {
    return { blackText: '-', whiteText: '+', blackOutcome: 'loss' };
  }
  if (match.result === 'WF' || match.result === 'B' || match.result === '1:0') {
    return { blackText: '1', whiteText: '0', blackOutcome: 'win' };
  }
  if (match.result === 'BF' || match.result === 'W' || match.result === '0:1') {
    return { blackText: '0', whiteText: '1', blackOutcome: 'loss' };
  }
  if (match.result === 'D' || match.result === '0.5:0.5') {
    return { blackText: '0.5', whiteText: '0.5', blackOutcome: 'draw' };
  }
  return {
    blackText: match.result,
    whiteText: '',
    blackOutcome: null,
  };
}

const OUTCOME_LABEL: Record<'win' | 'draw' | 'loss', string> = {
  win: 'W',
  draw: 'D',
  loss: 'L',
};

function getEffectiveZones(tournament: TournamentItem | null): StandingsZone[] {
  if (tournament?.standingsZones && tournament.standingsZones.length > 0) {
    return tournament.standingsZones;
  }
  if (tournament?.qualifyCount) {
    return [
      {
        fromRank: 1,
        toRank: tournament.qualifyCount,
        bgColor: '#fff1f2',
        cutoffLabel: tournament.qualifyLabel || '录取',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
    ];
  }
  return [];
}

function renderCutoffRow(zone: StandingsZone | undefined, colSpan: number, key: string) {
  if (!zone?.cutoffLabel) return null;
  const dividerStyle = {
    ...(zone.cutoffLineColor ? { '--cutoff-line-color': zone.cutoffLineColor } : {}),
    ...(zone.cutoffColor ? { '--cutoff-color': zone.cutoffColor } : {}),
  } as CSSProperties;

  return (
    <tr key={key} className="cutoff-row">
      <td colSpan={colSpan}>
        <div className="cutoff-divider" style={dividerStyle}>
          <span className="cutoff-pill">{zone.cutoffLabel}</span>
        </div>
      </td>
    </tr>
  );
}

export function TournamentDetailPage() {
  const { tournamentId, roundNo } = useParams<{
    tournamentId: string;
    roundNo?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const numericId = Number(tournamentId);
  const activeTab: 'matches' | 'standings' = location.pathname.includes('/standings')
    ? 'standings'
    : 'matches';

  const [tournament, setTournament] = useState<TournamentItem | null>(null);
  const [matches, setMatches] = useState<RenjuMatch[]>([]);
  const [footballMatches, setFootballMatches] = useState<FootballMatch[]>([]);
  const [footballDeductions, setFootballDeductions] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    matchService
      .getTournamentById(numericId)
      .then(async (tData) => {
        if (!active) return;
        setTournament(tData);
        if (!tData) return;

        if (tData.sport === 'football') {
          const [fMatches, fDeductions] = await Promise.all([
            matchService.getFootballMatches(numericId),
            matchService.getFootballDeductions(numericId),
          ]);
          if (!active) return;
          setFootballMatches(fMatches);
          setFootballDeductions(fDeductions);
        } else {
          const mData = await matchService.getMatchesByTournament(numericId);
          if (!active) return;
          setMatches(mData);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : '加载对局失败');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [numericId]);

  const isFootball = tournament?.sport === 'football';

  const rounds = useMemo(() => {
    const source = isFootball ? footballMatches : matches;
    const set = new Set(source.map((m) => m.roundNo));
    return Array.from(set).sort((a, b) => a - b);
  }, [isFootball, footballMatches, matches]);

  const defaultRound = useMemo(() => {
    if (rounds.length === 0) return 1;
    return isFootball || activeTab === 'standings'
      ? rounds[rounds.length - 1]
      : rounds[0];
  }, [rounds, isFootball, activeTab]);

  const currentRound = useMemo(() => {
    const parsed = roundNo ? Number(roundNo) : NaN;
    if (Number.isInteger(parsed) && rounds.includes(parsed)) {
      return parsed;
    }
    return defaultRound;
  }, [roundNo, rounds, defaultRound]);

  useEffect(() => {
    if (loading || rounds.length === 0) return;
    const parsed = roundNo ? Number(roundNo) : NaN;
    if (!Number.isInteger(parsed) || !rounds.includes(parsed)) {
      const target =
        activeTab === 'standings'
          ? `/matches/${numericId}/standings/round/${defaultRound}`
          : `/matches/${numericId}/round/${defaultRound}`;
      navigate(target, { replace: true });
    }
  }, [loading, rounds, roundNo, activeTab, numericId, defaultRound, navigate]);

  const goToView = (tab: 'matches' | 'standings', round: number) => {
    navigate(
      tab === 'standings'
        ? `/matches/${numericId}/standings/round/${round}`
        : `/matches/${numericId}/round/${round}`,
    );
  };

  const roundIndex = rounds.indexOf(currentRound);

  const roundMatches = useMemo(
    () => matches.filter((m) => m.roundNo === currentRound),
    [matches, currentRound],
  );

  const roundFootballMatches = useMemo(
    () => footballMatches.filter((m) => m.roundNo === currentRound),
    [footballMatches, currentRound],
  );

  const prevScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches) {
      if (m.roundNo >= currentRound || !m.result) continue;
      if (m.result === 'B' || m.result === '+' || m.result === 'WF' || m.result === '1:0') {
        map.set(m.blackId, (map.get(m.blackId) ?? 0) + 1);
      } else if (m.result === 'W' || m.result === '-' || m.result === 'BF' || m.result === '0:1') {
        map.set(m.whiteId, (map.get(m.whiteId) ?? 0) + 1);
      } else if (m.result === 'D' || m.result === '0.5:0.5') {
        map.set(m.blackId, (map.get(m.blackId) ?? 0) + 0.5);
        map.set(m.whiteId, (map.get(m.whiteId) ?? 0) + 0.5);
      }
    }
    return map;
  }, [matches, currentRound]);

  const tiebreakers: TiebreakerKey[] = tournament?.tiebreakers ?? [
    'buchholz',
    'median_buchholz',
    'wins',
  ];

  const standings = useMemo(
    () => computeStandings(matches, tournament, currentRound),
    [matches, tournament, currentRound],
  );

  const footballStandings = useMemo(
    () =>
      computeFootballStandings(
        footballMatches,
        footballDeductions,
        currentRound,
      ),
    [footballMatches, footballDeductions, currentRound],
  );

  const zones = useMemo(() => getEffectiveZones(tournament), [tournament]);

  return (
    <div className="tournament-page">
      <div className="league-banner">
        <div
          className="container"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 0 }}
        >
          <Link
            to="/matches"
            aria-label="返回赛事列表"
            style={{
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={22} />
          </Link>
          <div style={{ fontSize: '1.02rem', fontWeight: 700, lineHeight: 1.35 }}>
            {tournament?.name || '赛事对局'}
          </div>
        </div>
      </div>

      <div className="league-subtabs" role="tablist" aria-label="赛事视图切换">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'matches'}
          className={`league-subtab ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => goToView('matches', currentRound)}
        >
          比赛
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'standings'}
          className={`league-subtab ${activeTab === 'standings' ? 'active' : ''}`}
          onClick={() => goToView('standings', currentRound)}
        >
          积分
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ margin: 16, padding: 24 }}>
          <div className="skeleton" style={{ height: 96 }} />
        </div>
      ) : error ? (
        <div style={{ padding: 16 }}>
          <EmptyState title="对局加载失败" description={error} />
        </div>
      ) : isFootball ? (
        activeTab === 'standings' ? (
          <>
            <div
              className="round-bar"
              style={{ borderBottom: '1px solid var(--color-surface-muted)', paddingBottom: 10 }}
            >
              <button
                type="button"
                className="round-btn left"
                disabled={roundIndex <= 0}
                onClick={() => goToView('standings', rounds[roundIndex - 1])}
              >
                <ChevronLeft size={15} />
                上一轮
              </button>

              <span>第{currentRound}轮</span>

              <button
                type="button"
                className="round-btn right"
                disabled={roundIndex === -1 || roundIndex >= rounds.length - 1}
                onClick={() => goToView('standings', rounds[roundIndex + 1])}
              >
                下一轮
                <ChevronRight size={15} />
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="standings-board">
                <thead>
                  <tr>
                    <th>名次</th>
                    <th>球队</th>
                    <th>赛</th>
                    <th>胜/平/负</th>
                    <th>进/失</th>
                    <th>净胜</th>
                    <th>积分</th>
                  </tr>
                </thead>
                <tbody>
                  {footballStandings.map((row, idx) => {
                    const pos = idx + 1;
                    const rowZone = zones.find(
                      (z) => pos >= z.fromRank && pos <= z.toRank,
                    );
                    const beforeZone = zones.find(
                      (z) => z.cutoffBefore && z.fromRank === pos && idx > 0,
                    );
                    const afterZone = zones.find(
                      (z) =>
                        !z.cutoffBefore &&
                        z.toRank === pos &&
                        idx < footballStandings.length - 1,
                    );
                    const gd = row.goalsFor - row.goalsAgainst;
                    const gdText = gd > 0 ? `+${gd}` : `${gd}`;

                    return (
                      <Fragment key={row.teamName}>
                        {renderCutoffRow(
                          beforeZone,
                          7,
                          `${row.teamName}-before-cutoff`,
                        )}
                        <tr
                          className={rowZone?.bgColor ? 'zone-row' : undefined}
                          style={
                            rowZone?.bgColor
                              ? ({ '--zone-bg': rowZone.bgColor } as CSSProperties)
                              : undefined
                          }
                        >
                          <td className="tabular-nums" style={{ fontWeight: 600 }}>
                            {row.rank}
                          </td>
                          <td style={{ fontWeight: 600 }}>{row.teamName}</td>
                          <td className="tabular-nums">{row.played}</td>
                          <td
                            className="tabular-nums"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {row.wins}/{row.draws}/{row.losses}
                          </td>
                          <td className="tabular-nums">
                            {row.goalsFor}/{row.goalsAgainst}
                          </td>
                          <td className="tabular-nums">{gdText}</td>
                          <td className="tabular-nums" style={{ fontWeight: 800 }}>
                            {row.points}
                          </td>
                        </tr>
                        {renderCutoffRow(
                          afterZone,
                          7,
                          `${row.teamName}-after-cutoff`,
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {tournament?.rulesText ? (
              <section className="rules-section">
                <h2 className="rules-section-title">赛制说明</h2>
                <p className="rules-section-body">{tournament.rulesText}</p>
              </section>
            ) : null}
          </>
        ) : (
          <>
            <div
              className="round-bar"
              style={{
                borderBottom: '1px solid var(--color-surface-muted)',
                paddingBottom: 10,
              }}
            >
              <button
                type="button"
                className="round-btn left"
                disabled={roundIndex <= 0}
                onClick={() => goToView('matches', rounds[roundIndex - 1])}
              >
                <ChevronLeft size={15} />
                上一轮
              </button>

              <span>第{currentRound}轮</span>

              <button
                type="button"
                className="round-btn right"
                disabled={roundIndex === -1 || roundIndex >= rounds.length - 1}
                onClick={() => goToView('matches', rounds[roundIndex + 1])}
              >
                下一轮
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="fixture-list">
              {roundFootballMatches.map((m) => {
                const dt = formatScheduleLines(m.matchTime);
                const hasScore =
                  m.homeScore !== null && m.awayScore !== null;
                const homeOutcome: 'win' | 'draw' | 'loss' | null = !hasScore
                  ? null
                  : m.homeScore! > m.awayScore!
                    ? 'win'
                    : m.homeScore! < m.awayScore!
                      ? 'loss'
                      : 'draw';

                return (
                  <div key={m.id} className="fixture-row">
                    <div className="fixture-meta tabular-nums">
                      <span>{dt.date}</span>
                      <span>{dt.time}</span>
                    </div>

                    <div className="fixture-players">
                      <div className="fixture-player-line">
                        <span>{m.homeTeam}</span>
                      </div>
                      <div className="fixture-player-line">
                        <span>{m.awayTeam}</span>
                      </div>
                    </div>

                    <div className="fixture-scores tabular-nums">
                      <div
                        className={`fixture-score-line ${
                          !hasScore
                            ? 'muted'
                            : homeOutcome === 'loss'
                              ? 'loser'
                              : ''
                        }`}
                      >
                        <span>{hasScore ? m.homeScore : '-'}</span>
                        {homeOutcome ? (
                          <span className={`result-dot ${homeOutcome}`}>
                            {OUTCOME_LABEL[homeOutcome]}
                          </span>
                        ) : (
                          <span aria-hidden="true" />
                        )}
                      </div>
                      <div
                        className={`fixture-score-line ${
                          !hasScore
                            ? 'muted'
                            : homeOutcome === 'win'
                              ? 'loser'
                              : ''
                        }`}
                      >
                        <span>{hasScore ? m.awayScore : '-'}</span>
                        <span aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : matches.length === 0 ? (
        <div style={{ padding: 16 }}>
          <EmptyState
            title="暂无对局数据"
            description="请先在 Supabase 执行最新的 schema.sql 导入对局数据。"
          />
        </div>
      ) : activeTab === 'standings' ? (
        <>
          <div
            className="round-bar"
            style={{ borderBottom: '1px solid var(--color-surface-muted)', paddingBottom: 10 }}
          >
            <button
              type="button"
              className="round-btn left"
              disabled={roundIndex <= 0}
              onClick={() => goToView('standings', rounds[roundIndex - 1])}
            >
              <ChevronLeft size={15} />
              上一轮
            </button>

            <span>第{currentRound}轮</span>

            <button
              type="button"
              className="round-btn right"
              disabled={roundIndex === -1 || roundIndex >= rounds.length - 1}
              onClick={() => goToView('standings', rounds[roundIndex + 1])}
            >
              下一轮
              <ChevronRight size={15} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="standings-board">
              <thead>
                <tr>
                  <th>名次</th>
                  <th>棋手</th>
                  <th>赛</th>
                  <th>胜/平/负</th>
                  <th>积分</th>
                  {tiebreakers.map((tb) => (
                    <th key={tb}>{TIEBREAKER_HEADER[tb]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((row, idx) => {
                  const pos = idx + 1;
                  const rowZone = zones.find(
                    (z) => pos >= z.fromRank && pos <= z.toRank,
                  );
                  const beforeZone = zones.find(
                    (z) => z.cutoffBefore && z.fromRank === pos && idx > 0,
                  );
                  const afterZone = zones.find(
                    (z) =>
                      !z.cutoffBefore &&
                      z.toRank === pos &&
                      idx < standings.length - 1,
                  );

                  return (
                    <Fragment key={row.playerId}>
                      {renderCutoffRow(
                        beforeZone,
                        5 + tiebreakers.length,
                        `${row.playerId}-before-cutoff`,
                      )}
                      <tr
                        className={rowZone?.bgColor ? 'zone-row' : undefined}
                        style={
                          rowZone?.bgColor
                            ? ({ '--zone-bg': rowZone.bgColor } as CSSProperties)
                            : undefined
                        }
                      >
                        <td className="tabular-nums" style={{ fontWeight: 600 }}>
                          {row.rank}
                        </td>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {row.playerNo !== undefined ? (
                            <span
                              className="tabular-nums"
                              style={{
                                color: 'var(--color-text-muted)',
                                fontSize: '0.78rem',
                                marginRight: 6,
                              }}
                            >
                              {row.playerNo}
                            </span>
                          ) : null}
                          {row.playerName}
                        </td>
                        <td className="tabular-nums">{row.played}</td>
                        <td
                          className="tabular-nums"
                          style={{
                            color: 'var(--color-text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.wins}/{row.draws}/{row.losses}
                        </td>
                        <td className="tabular-nums" style={{ fontWeight: 800 }}>
                          {row.points}
                        </td>
                        {tiebreakers.map((tb) => (
                          <td key={tb} className="tabular-nums">
                            {getTiebreakerValue(row, tb)}
                          </td>
                        ))}
                      </tr>
                      {renderCutoffRow(
                        afterZone,
                        5 + tiebreakers.length,
                        `${row.playerId}-after-cutoff`,
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {tournament?.rulesText ? (
            <section className="rules-section">
              <h2 className="rules-section-title">赛制说明</h2>
              <p className="rules-section-body">{tournament.rulesText}</p>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <div
            className="round-bar"
            style={{ borderBottom: '1px solid var(--color-surface-muted)', paddingBottom: 10 }}
          >
            <button
              type="button"
              className="round-btn left"
              disabled={roundIndex <= 0}
              onClick={() => goToView('matches', rounds[roundIndex - 1])}
            >
              <ChevronLeft size={15} />
              上一轮
            </button>

            <span>第{currentRound}轮</span>

            <button
              type="button"
              className="round-btn right"
              disabled={roundIndex === -1 || roundIndex >= rounds.length - 1}
              onClick={() => goToView('matches', rounds[roundIndex + 1])}
            >
              下一轮
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="fixture-list">
            {roundMatches.map((match) => {
              const score = getDisplayScores(match);
              const dt = formatScheduleLines(match.matchTime);
              return (
                <div key={match.id} className="fixture-row">
                  <div className="fixture-meta tabular-nums">
                    <span>{dt.date}</span>
                    <span>{dt.time}</span>
                  </div>

                  <div className="fixture-players">
                    <div className="fixture-player-line">
                      {match.blackId !== 'BYE' && match.blackNo !== undefined ? (
                        <span className="fixture-player-id tabular-nums">
                          {match.blackNo}
                        </span>
                      ) : null}
                      <span>{match.blackName}</span>
                      {match.blackId !== 'BYE' ? (
                        <span className="fixture-player-id tabular-nums">
                          {prevScores.get(match.blackId) ?? 0}
                        </span>
                      ) : null}
                    </div>

                    <div className="fixture-player-line">
                      {match.whiteId !== 'BYE' && match.whiteNo !== undefined ? (
                        <span className="fixture-player-id tabular-nums">
                          {match.whiteNo}
                        </span>
                      ) : null}
                      <span>{match.whiteName}</span>
                      {match.whiteId !== 'BYE' ? (
                        <span className="fixture-player-id tabular-nums">
                          {prevScores.get(match.whiteId) ?? 0}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="fixture-scores tabular-nums">
                    <div
                      className={`fixture-score-line ${
                        !match.result
                          ? 'muted'
                          : score.blackOutcome === 'loss'
                            ? 'loser'
                            : ''
                      }`}
                    >
                      <span>{score.blackText}</span>
                      {score.blackOutcome ? (
                        <span className={`result-dot ${score.blackOutcome}`}>
                          {OUTCOME_LABEL[score.blackOutcome]}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={`fixture-score-line ${
                        !match.result
                          ? 'muted'
                          : score.blackOutcome === 'win'
                            ? 'loser'
                            : ''
                      }`}
                    >
                      <span>{score.whiteText}</span>
                      <span aria-hidden="true" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
