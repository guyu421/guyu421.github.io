import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type CSSProperties, Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { matchService } from '@/services/matchService';
import { useAppStore } from '@/store/AppContext';
import type {
  FootballMatch,
  RenjuBracketMatch,
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

const TIEBREAKER_HEADER: Partial<Record<TiebreakerKey, string>> = {
  buchholz: '对手分',
  median_buchholz: '中间对手分',
  progressive_buchholz: '递减最低对手分',
  wins: '胜局数',
  direct_encounter: '直胜',
};

function getTiebreakerValue(row: StandingEntry, key: TiebreakerKey): string | number {
  if (key === 'buchholz') return row.buchholz;
  if (key === 'median_buchholz') return row.medianBuchholz;
  if (key === 'progressive_buchholz') return row.progressiveBuchholz ?? '';
  if (key === 'direct_encounter') return row.directEncounter ?? '';
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
  forfeitSide: 'black' | 'white' | null;
} {
  const isBye = match.whiteId === 'BYE' || match.blackId === 'BYE';
  if (!match.result) {
    return { blackText: '-', whiteText: '-', blackOutcome: null, forfeitSide: null };
  }
  if (match.result === '+' || match.result === 'WF') {
    return {
      blackText: '+',
      whiteText: '-',
      blackOutcome: 'win',
      forfeitSide: isBye ? null : 'white',
    };
  }
  if (match.result === '-' || match.result === 'BF') {
    return {
      blackText: '-',
      whiteText: '+',
      blackOutcome: 'loss',
      forfeitSide: isBye ? null : 'black',
    };
  }
  if (match.result === 'B' || match.result === '1:0') {
    return { blackText: '1', whiteText: '0', blackOutcome: 'win', forfeitSide: null };
  }
  if (match.result === 'W' || match.result === '0:1') {
    return { blackText: '0', whiteText: '1', blackOutcome: 'loss', forfeitSide: null };
  }
  if (match.result === 'D' || match.result === '0.5:0.5') {
    return { blackText: '0.5', whiteText: '0.5', blackOutcome: 'draw', forfeitSide: null };
  }
  return {
    blackText: match.result,
    whiteText: '',
    blackOutcome: null,
    forfeitSide: null,
  };
}

const OUTCOME_LABEL: Record<'win' | 'draw' | 'loss', string> = {
  win: 'W',
  draw: 'D',
  loss: 'L',
};

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
  const { searchQuery } = useAppStore();
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const numericId = Number(tournamentId);
  const activeTab: 'matches' | 'standings' = location.pathname.includes('/standings')
    ? 'standings'
    : 'matches';

  const [tournament, setTournament] = useState<TournamentItem | null>(null);
  const [matches, setMatches] = useState<RenjuMatch[]>([]);
  const [bracketMatches, setBracketMatches] = useState<RenjuBracketMatch[]>([]);
  const [footballMatches, setFootballMatches] = useState<FootballMatch[]>([]);
  const [footballDeductions, setFootballDeductions] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [footballTeamLogos, setFootballTeamLogos] = useState<Map<string, string>>(
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
          const [fMatches, fDeductions, fLogos] = await Promise.all([
            matchService.getFootballMatches(numericId),
            matchService.getFootballDeductions(numericId),
            matchService.getFootballTeamLogos(numericId),
          ]);
          if (!active) return;
          setFootballMatches(fMatches);
          setFootballDeductions(fDeductions);
          setFootballTeamLogos(fLogos);
        } else {
          const [mData, bData] = await Promise.all([
            matchService.getMatchesByTournament(numericId),
            matchService.getBracketMatches(numericId),
          ]);
          if (!active) return;
          setMatches(mData);
          setBracketMatches(bData);
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

  const hasBracket = bracketMatches.length > 0;

  const finalsInfo = useMemo(() => {
    if (!hasBracket) return null;
    const semis = bracketMatches.filter(
      (m) => m.stageRound === 1 && m.bracketType === 'main',
    );
    const finalMatch = bracketMatches.find(
      (m) => m.stageRound === 2 && m.bracketType === 'main',
    );
    const thirdMatch = bracketMatches.find(
      (m) => m.bracketType === 'third_place',
    );
    const champion = finalMatch
      ? finalMatch.winnerSlot === 1
        ? finalMatch.player1Name
        : finalMatch.player2Name
      : null;
    const runnerUp = finalMatch
      ? finalMatch.winnerSlot === 1
        ? finalMatch.player2Name
        : finalMatch.player1Name
      : null;
    const thirdPlace = thirdMatch
      ? thirdMatch.winnerSlot === 1
        ? thirdMatch.player1Name
        : thirdMatch.player2Name
      : null;
    const fourthPlace = thirdMatch
      ? thirdMatch.winnerSlot === 1
        ? thirdMatch.player2Name
        : thirdMatch.player1Name
      : null;

    return {
      semi1: semis[0],
      semi2: semis[1],
      finalMatch,
      thirdMatch,
      champion,
      runnerUp,
      thirdPlace,
      fourthPlace,
    };
  }, [hasBracket, bracketMatches]);

  const roundIndex = rounds.indexOf(currentRound);

  const roundMatches = useMemo(
    () =>
      matches.filter((m) => {
        if (m.roundNo !== currentRound) return false;
        if (!normalizedQuery) return true;
        return (
          m.blackName.toLowerCase().includes(normalizedQuery) ||
          m.whiteName.toLowerCase().includes(normalizedQuery)
        );
      }),
    [matches, currentRound, normalizedQuery],
  );

  const roundFootballMatches = useMemo(
    () =>
      footballMatches.filter((m) => {
        if (m.roundNo !== currentRound) return false;
        if (!normalizedQuery) return true;
        return (
          m.homeTeam.toLowerCase().includes(normalizedQuery) ||
          m.awayTeam.toLowerCase().includes(normalizedQuery)
        );
      }),
    [footballMatches, currentRound, normalizedQuery],
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

  const prevFootballScores = useMemo(() => {
    const map = new Map<string, number>();
    const winPts = tournament?.winPoints ?? 3;
    const drawPts = tournament?.drawPoints ?? 1;
    const lossPts = tournament?.lossPoints ?? 0;

    for (const m of footballMatches) {
      if (!map.has(m.homeTeam)) {
        map.set(m.homeTeam, -(footballDeductions.get(m.homeTeam) ?? 0));
      }
      if (!map.has(m.awayTeam)) {
        map.set(m.awayTeam, -(footballDeductions.get(m.awayTeam) ?? 0));
      }
    }

    for (const m of footballMatches) {
      if (m.roundNo >= currentRound) continue;
      if (m.homeScore === null || m.awayScore === null) continue;
      if (m.homeScore > m.awayScore) {
        map.set(m.homeTeam, (map.get(m.homeTeam) ?? 0) + winPts);
        map.set(m.awayTeam, (map.get(m.awayTeam) ?? 0) + lossPts);
      } else if (m.homeScore < m.awayScore) {
        map.set(m.awayTeam, (map.get(m.awayTeam) ?? 0) + winPts);
        map.set(m.homeTeam, (map.get(m.homeTeam) ?? 0) + lossPts);
      } else {
        map.set(m.homeTeam, (map.get(m.homeTeam) ?? 0) + drawPts);
        map.set(m.awayTeam, (map.get(m.awayTeam) ?? 0) + drawPts);
      }
    }
    return map;
  }, [footballMatches, footballDeductions, tournament, currentRound]);

  const tiebreakers: TiebreakerKey[] = tournament?.tiebreakers ?? [
    'buchholz',
    'median_buchholz',
    'wins',
  ];

  const standings = useMemo(() => {
    const all = computeStandings(matches, tournament, currentRound);
    if (!normalizedQuery) return all;
    return all.filter((r) => r.playerName.toLowerCase().includes(normalizedQuery));
  }, [matches, tournament, currentRound, normalizedQuery]);

  const footballStandings = useMemo(() => {
    const all = computeFootballStandings(
      footballMatches,
      footballDeductions,
      tournament,
      currentRound,
    );
    if (!normalizedQuery) return all;
    return all.filter((r) => r.teamName.toLowerCase().includes(normalizedQuery));
  }, [footballMatches, footballDeductions, tournament, currentRound, normalizedQuery]);

  const zones = useMemo<StandingsZone[]>(() => {
    const raw = tournament?.standingsZones ?? [];
    if (
      tournament?.sport === 'renju' &&
      raw.length === 1 &&
      !raw[0].cutoffBefore &&
      raw[0].fromRank === 1
    ) {
      const z = raw[0];
      const isAward = z.cutoffLabel === '录取线' || z.toRank === 16;
      return [
        {
          fromRank: 1,
          toRank: z.toRank,
          bgColor: z.bgColor || '#fff1f2',
          cutoffBefore: true,
          cutoffLabel: isAward ? '获奖' : z.cutoffLabel || '晋级决赛',
          cutoffColor: '#f43f5e',
          cutoffLineColor: '#fda4af',
        },
        {
          fromRank: z.toRank + 1,
          toRank: 999,
          bgColor: '',
          cutoffBefore: true,
          cutoffLabel: isAward ? '未获奖' : '未晋级决赛',
          cutoffColor: '#64748b',
          cutoffLineColor: '#cbd5e1',
        },
      ];
    }
    return raw;
  }, [tournament]);

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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '1.02rem',
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            {tournament?.logoUrl ? (
              <img
                className="league-logo"
                src={tournament.logoUrl}
                alt=""
              />
            ) : null}
            <span>{tournament?.name || '赛事对局'}</span>
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
                    const beforeZone = !normalizedQuery
                      ? zones.find((z) => z.cutoffBefore && z.fromRank === pos)
                      : undefined;
                    const afterZone = !normalizedQuery
                      ? zones.find(
                          (z) =>
                            !z.cutoffBefore &&
                            z.toRank === pos &&
                            idx < footballStandings.length - 1,
                        )
                      : undefined;
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
                          <td style={{ fontWeight: 600 }}>
                            <span className="team-cell">
                              {footballTeamLogos.get(row.teamName) ? (
                                <img
                                  className="team-logo"
                                  src={footballTeamLogos.get(row.teamName)}
                                  alt=""
                                  loading="lazy"
                                />
                              ) : null}
                              <span>{row.teamName}</span>
                            </span>
                          </td>
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
                        {footballTeamLogos.get(m.homeTeam) ? (
                          <img
                            className="team-logo"
                            src={footballTeamLogos.get(m.homeTeam)}
                            alt=""
                            loading="lazy"
                          />
                        ) : null}
                        <span>{m.homeTeam}</span>
                        <span className="fixture-player-id tabular-nums">
                          {prevFootballScores.get(m.homeTeam) ?? 0}
                        </span>
                      </div>
                      <div className="fixture-player-line">
                        {footballTeamLogos.get(m.awayTeam) ? (
                          <img
                            className="team-logo"
                            src={footballTeamLogos.get(m.awayTeam)}
                            alt=""
                            loading="lazy"
                          />
                        ) : null}
                        <span>{m.awayTeam}</span>
                        <span className="fixture-player-id tabular-nums">
                          {prevFootballScores.get(m.awayTeam) ?? 0}
                        </span>
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
            description="暂无该赛事的对局数据。"
          />
        </div>
      ) : activeTab === 'standings' ? (
        <>
          {finalsInfo?.champion ? (
            <>
              <div style={{ padding: '16px 16px 8px' }}>
                <div className="v-stage-label" style={{ textAlign: 'left', marginBottom: 0 }}>
                  决赛
                </div>
              </div>
              <div className="table-scroll">
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>名次</th>
                      <th>棋手</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="zone-row" style={{ '--zone-bg': '#fff1f2' } as CSSProperties}>
                      <td className="tabular-nums" style={{ fontWeight: 600 }}>1</td>
                      <td style={{ fontWeight: 600 }}>{finalsInfo.champion}</td>
                    </tr>
                    {finalsInfo.runnerUp ? (
                      <tr>
                        <td className="tabular-nums" style={{ fontWeight: 600 }}>2</td>
                        <td style={{ fontWeight: 600 }}>{finalsInfo.runnerUp}</td>
                      </tr>
                    ) : null}
                    {finalsInfo.thirdPlace ? (
                      <tr>
                        <td className="tabular-nums" style={{ fontWeight: 600 }}>3</td>
                        <td style={{ fontWeight: 600 }}>{finalsInfo.thirdPlace}</td>
                      </tr>
                    ) : null}
                    {finalsInfo.fourthPlace ? (
                      <tr>
                        <td className="tabular-nums" style={{ fontWeight: 600 }}>4</td>
                        <td style={{ fontWeight: 600 }}>{finalsInfo.fourthPlace}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '14px 16px 0' }}>
                <div className="v-stage-label" style={{ textAlign: 'left', marginBottom: 0 }}>
                  预赛
                </div>
              </div>
            </>
          ) : null}

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
                  const beforeZone = !normalizedQuery
                    ? zones.find((z) => z.cutoffBefore && z.fromRank === pos)
                    : undefined;
                  const afterZone = !normalizedQuery
                    ? zones.find(
                        (z) =>
                          !z.cutoffBefore &&
                          z.toRank === pos &&
                          idx < standings.length - 1,
                      )
                    : undefined;

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
                          <span className="team-cell">
                            {row.playerNo !== undefined ? (
                              <span className="player-no tabular-nums">
                                {row.playerNo}
                              </span>
                            ) : null}
                            <span>{row.playerName}</span>
                          </span>
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
          {finalsInfo ? (
            <div className="bracket-section" style={{ paddingBottom: 16 }}>
              <div className="v-stage-label" style={{ textAlign: 'left', marginBottom: 10 }}>
                决赛
              </div>
              <div className="v-bracket-clean">
                {finalsInfo.semi1 ? (
                  <>
                    <div className="v-match-row">
                      <span
                        className={`v-player ${
                          finalsInfo.semi1.winnerSlot === 1 ? 'winner' : 'loser'
                        }`}
                      >
                        <span>{finalsInfo.semi1.player1Name}</span>
                      </span>
                      <span className="v-score tabular-nums">
                        {finalsInfo.semi1.player1Score}-{finalsInfo.semi1.player2Score}
                      </span>
                      <span
                        className={`v-player ${
                          finalsInfo.semi1.winnerSlot === 2 ? 'winner' : 'loser'
                        }`}
                      >
                        <span>{finalsInfo.semi1.player2Name}</span>
                      </span>
                    </div>
                    <svg
                      className="v-fork-svg"
                      viewBox="0 0 200 36"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      {finalsInfo.semi1.winnerSlot === 2 ? (
                        <>
                          <path
                            d="M 44 0 V 18 H 100"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                          <path
                            d="M 156 0 V 18 H 100 V 36"
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      ) : (
                        <>
                          <path
                            d="M 156 0 V 18 H 100"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                          <path
                            d="M 44 0 V 18 H 100 V 36"
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      )}
                    </svg>
                  </>
                ) : null}

                {finalsInfo.finalMatch ? (
                  <div className="v-match-row v-final-row">
                    <span
                      className={`v-player ${
                        finalsInfo.finalMatch.winnerSlot === 1 ? 'winner' : 'loser'
                      }`}
                    >
                      <span>{finalsInfo.finalMatch.player1Name}</span>
                    </span>
                    <span className="v-score tabular-nums">
                      {finalsInfo.finalMatch.player1Score}-
                      {finalsInfo.finalMatch.player2Score}
                    </span>
                    <span
                      className={`v-player ${
                        finalsInfo.finalMatch.winnerSlot === 2 ? 'winner' : 'loser'
                      }`}
                    >
                      <span>{finalsInfo.finalMatch.player2Name}</span>
                    </span>
                  </div>
                ) : null}

                {finalsInfo.semi2 ? (
                  <>
                    <svg
                      className="v-fork-svg"
                      viewBox="0 0 200 36"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      {finalsInfo.semi2.winnerSlot === 2 ? (
                        <>
                          <path
                            d="M 44 36 V 18 H 100"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                          <path
                            d="M 156 36 V 18 H 100 V 0"
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      ) : (
                        <>
                          <path
                            d="M 156 36 V 18 H 100"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                          <path
                            d="M 44 36 V 18 H 100 V 0"
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      )}
                    </svg>
                    <div className="v-match-row">
                      <span
                        className={`v-player ${
                          finalsInfo.semi2.winnerSlot === 1 ? 'winner' : 'loser'
                        }`}
                      >
                        <span>{finalsInfo.semi2.player1Name}</span>
                      </span>
                      <span className="v-score tabular-nums">
                        {finalsInfo.semi2.player1Score}-{finalsInfo.semi2.player2Score}
                      </span>
                      <span
                        className={`v-player ${
                          finalsInfo.semi2.winnerSlot === 2 ? 'winner' : 'loser'
                        }`}
                      >
                        <span>{finalsInfo.semi2.player2Name}</span>
                      </span>
                    </div>
                  </>
                ) : null}
              </div>

              {finalsInfo.thirdMatch ? (
                <div className="v-third-clean">
                  <div className="v-stage-label" style={{ marginBottom: 8 }}>
                    季军赛
                  </div>
                  <div className="v-match-row v-final-row">
                    <span
                      className={`v-player ${
                        finalsInfo.thirdMatch.winnerSlot === 1 ? 'winner' : 'loser'
                      }`}
                    >
                      <span>{finalsInfo.thirdMatch.player1Name}</span>
                    </span>
                    <span className="v-score tabular-nums">
                      {finalsInfo.thirdMatch.player1Score}-
                      {finalsInfo.thirdMatch.player2Score}
                    </span>
                    <span
                      className={`v-player ${
                        finalsInfo.thirdMatch.winnerSlot === 2 ? 'winner' : 'loser'
                      }`}
                    >
                      <span>{finalsInfo.thirdMatch.player2Name}</span>
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="v-stage-label" style={{ textAlign: 'left', margin: '18px 0 0' }}>
                预赛
              </div>
            </div>
          ) : null}

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
                        <span className="player-no tabular-nums">
                          {match.blackNo}
                        </span>
                      ) : null}
                      <span>{match.blackName}</span>
                      {match.blackId !== 'BYE' ? (
                        <span className="fixture-player-id tabular-nums">
                          {prevScores.get(match.blackId) ?? 0}
                        </span>
                      ) : null}
                      {score.forfeitSide === 'black' ? (
                        <span className="forfeit-badge">退赛</span>
                      ) : null}
                    </div>

                    <div className="fixture-player-line">
                      {match.whiteId !== 'BYE' && match.whiteNo !== undefined ? (
                        <span className="player-no tabular-nums">
                          {match.whiteNo}
                        </span>
                      ) : null}
                      <span>{match.whiteName}</span>
                      {match.whiteId !== 'BYE' ? (
                        <span className="fixture-player-id tabular-nums">
                          {prevScores.get(match.whiteId) ?? 0}
                        </span>
                      ) : null}
                      {score.forfeitSide === 'white' ? (
                        <span className="forfeit-badge">退赛</span>
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
