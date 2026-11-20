import { ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { overlayEspnLiveScores } from '@/services/espnLiveService';
import { matchService } from '@/services/matchService';
import type { FootballMatch, RenjuMatch, TournamentItem } from '@/types/match';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  })
    .format(d)
    .replace(/\//g, '-');
}

function parseRenjuOutcome(result: string | null): {
  blackText: string;
  whiteText: string;
  winner: 'black' | 'white' | 'draw' | null;
} {
  if (!result) return { blackText: '-', whiteText: '-', winner: null };
  if (result === '+' || result === 'WF') {
    return { blackText: '+', whiteText: '-', winner: 'black' };
  }
  if (result === '-' || result === 'BF') {
    return { blackText: '-', whiteText: '+', winner: 'white' };
  }
  if (result === 'B' || result === '1:0') {
    return { blackText: '1', whiteText: '0', winner: 'black' };
  }
  if (result === 'W' || result === '0:1') {
    return { blackText: '0', whiteText: '1', winner: 'white' };
  }
  if (result === 'D' || result === '0.5:0.5') {
    return { blackText: '0.5', whiteText: '0.5', winner: 'draw' };
  }
  return { blackText: result, whiteText: '', winner: null };
}

const OUTCOME_LABEL: Record<'win' | 'draw' | 'loss', string> = {
  win: 'W',
  draw: 'D',
  loss: 'L',
};

export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const location = useLocation();
  const routeState = (location.state as {
    sport?: 'renju' | 'football';
    tournamentId?: number;
    isBracket?: boolean;
  } | null) ?? null;
  const mid = Number(matchId);

  const [tournament, setTournament] = useState<TournamentItem | null>(null);
  const [renjuMatch, setRenjuMatch] = useState<
    (RenjuMatch & { stageLabel?: string }) | null
  >(null);
  const [footballMatch, setFootballMatch] = useState<FootballMatch | null>(null);
  const [teamLogos, setTeamLogos] = useState<Map<string, string>>(new Map());
  const [renjuH2H, setRenjuH2H] = useState<
    Array<RenjuMatch & { tournamentName: string; stageLabel?: string }>
  >([]);
  const [footballH2H, setFootballH2H] = useState<
    Array<FootballMatch & { tournamentName: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(mid) || mid <= 0) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    async function load() {
      const hintSport = routeState?.sport;
      const hintTid = routeState?.tournamentId;

      if (hintSport === 'football') {
        const fMatch = await matchService.getFootballMatchById(mid);
        if (!active || !fMatch) {
          if (active) setLoading(false);
          return;
        }
        const [tData, logos, h2h] = await Promise.all([
          matchService.getTournamentById(fMatch.tournamentId),
          matchService.getFootballTeamLogos(fMatch.tournamentId),
          matchService.getFootballHeadToHead(fMatch.homeTeam, fMatch.awayTeam),
        ]);
        if (!active) return;
        setTournament(tData);
        setFootballMatch(fMatch);
        setRenjuMatch(null);
        setTeamLogos(logos);
        const curTs = new Date(fMatch.matchTime).getTime();
        setFootballH2H(
          h2h.filter((m) => m.id !== fMatch.id && new Date(m.matchTime).getTime() < curTs),
        );
        if (tData) {
          void overlayEspnLiveScores(fMatch.tournamentId, tData.name, [fMatch])
            .then((merged) => {
              if (active && merged[0]) setFootballMatch(merged[0]);
            })
            .catch(() => {});
        }
        return;
      }

      const rMatch = routeState?.isBracket
        ? await matchService.getRenjuBracketMatchById(mid, hintTid)
        : await matchService.getRenjuMatchById(mid, hintTid);

      if (rMatch) {
        const [tData, h2h] = await Promise.all([
          matchService.getTournamentById(rMatch.tournamentId),
          matchService.getRenjuHeadToHead(
            rMatch.blackId,
            rMatch.whiteId,
            rMatch.blackName,
            rMatch.whiteName,
          ),
        ]);
        if (!active) return;
        setTournament(tData);
        setRenjuMatch(rMatch);
        setFootballMatch(null);
        const curTs = new Date(rMatch.matchTime).getTime();
        setRenjuH2H(
          h2h.filter((m) => m.id !== rMatch.id && new Date(m.matchTime).getTime() < curTs),
        );
        return;
      }

      const fMatch = await matchService.getFootballMatchById(mid);
      if (fMatch) {
        const [tData, logos, h2h] = await Promise.all([
          matchService.getTournamentById(fMatch.tournamentId),
          matchService.getFootballTeamLogos(fMatch.tournamentId),
          matchService.getFootballHeadToHead(fMatch.homeTeam, fMatch.awayTeam),
        ]);
        if (!active) return;
        setTournament(tData);
        setFootballMatch(fMatch);
        setRenjuMatch(null);
        setTeamLogos(logos);
        const curTs = new Date(fMatch.matchTime).getTime();
        setFootballH2H(
          h2h.filter((m) => m.id !== fMatch.id && new Date(m.matchTime).getTime() < curTs),
        );
      }
    }

    load()
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : '加载对局详情失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mid, routeState?.sport, routeState?.tournamentId, routeState?.isBracket]);

  const footballStats = useMemo(() => {
    if (!footballMatch) return { total: 0, homeWins: 0, draws: 0, awayWins: 0 };
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    let total = 0;
    for (const m of footballH2H) {
      if (m.homeScore === null || m.awayScore === null) continue;
      total += 1;
      const aScore =
        m.homeTeam === footballMatch.homeTeam ? m.homeScore : m.awayScore;
      const bScore =
        m.homeTeam === footballMatch.homeTeam ? m.awayScore : m.homeScore;
      if (aScore > bScore) homeWins += 1;
      else if (aScore < bScore) awayWins += 1;
      else draws += 1;
    }
    return { total, homeWins, draws, awayWins };
  }, [footballMatch, footballH2H]);

  const renjuStats = useMemo(() => {
    if (!renjuMatch) return { total: 0, aWins: 0, draws: 0, bWins: 0 };
    let aWins = 0;
    let draws = 0;
    let bWins = 0;
    let total = 0;
    for (const m of renjuH2H) {
      const parsed = parseRenjuOutcome(m.result);
      if (!parsed.winner) continue;
      total += 1;
      if (parsed.winner === 'draw') {
        draws += 1;
      } else {
        const winnerId = parsed.winner === 'black' ? m.blackId : m.whiteId;
        if (winnerId === renjuMatch.blackId) aWins += 1;
        else bWins += 1;
      }
    }
    return { total, aWins, draws, bWins };
  }, [renjuMatch, renjuH2H]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 20 }}>
        <div className="skeleton" style={{ height: 180, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 20 }}>
        <EmptyState title="加载失败" description={error} />
      </div>
    );
  }

  const activeMatch = footballMatch ?? renjuMatch;
  if (!tournament || !activeMatch) {
    return (
      <div className="container" style={{ paddingTop: 20 }}>
        <EmptyState title="未找到对局" description="该对局不存在或已被删除。" />
      </div>
    );
  }

  const backPath = renjuMatch?.stageLabel
    ? `/${tournament.id}`
    : `/${tournament.id}/${activeMatch.roundNo}`;

  return (
    <div className="tournament-page">
      <div className="league-banner">
        <div
          className="container"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 0 }}
        >
          <Link
            to={backPath}
            aria-label="返回赛事"
            style={{
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={22} />
          </Link>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '1rem',
                fontWeight: 800,
              }}
            >
              {tournament.logoUrl ? (
                <img
                  src={tournament.logoUrl}
                  alt={tournament.name}
                  className="league-logo"
                />
              ) : null}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tournament.name}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9, marginTop: 2 }}>
              {renjuMatch?.stageLabel
                ? renjuMatch.stageLabel
                : `第${activeMatch.roundNo}轮${renjuMatch ? ` · 第${renjuMatch.boardNo}台` : ''}`}
            </div>
          </div>
        </div>
      </div>

      {footballMatch ? (
        <>
          <div className="match-detail-hero">
            <div className="match-detail-time tabular-nums">
              <span>{formatDateTime(footballMatch.matchTime)}</span>
              {footballMatch.liveClock ? (
                <span className="live-clock-pill" style={{ marginLeft: 8 }}>
                  {footballMatch.liveClock}
                </span>
              ) : null}
            </div>
            <div className="match-detail-board">
              <Link
                to={`/team/${encodeURIComponent(footballMatch.homeTeam)}`}
                className="match-detail-side match-detail-side-link"
              >
                {teamLogos.get(footballMatch.homeTeam) ? (
                  <img
                    src={teamLogos.get(footballMatch.homeTeam)}
                    alt={footballMatch.homeTeam}
                    className="match-detail-logo"
                  />
                ) : null}
                <div className="match-detail-name">{footballMatch.homeTeam}</div>
                <div className="match-detail-tag">主队</div>
              </Link>

              <div className="match-detail-score tabular-nums">
                {footballMatch.homeScore !== null && footballMatch.awayScore !== null
                  ? `${footballMatch.homeScore} - ${footballMatch.awayScore}`
                  : 'VS'}
              </div>

              <Link
                to={`/team/${encodeURIComponent(footballMatch.awayTeam)}`}
                className="match-detail-side match-detail-side-link"
              >
                {teamLogos.get(footballMatch.awayTeam) ? (
                  <img
                    src={teamLogos.get(footballMatch.awayTeam)}
                    alt={footballMatch.awayTeam}
                    className="match-detail-logo"
                  />
                ) : null}
                <div className="match-detail-name">{footballMatch.awayTeam}</div>
                <div className="match-detail-tag">客队</div>
              </Link>
            </div>
          </div>

          <div className="h2h-section">
            <div className="h2h-header">
              <span>历史交锋</span>
              <span className="h2h-summary tabular-nums">
                {footballStats.total > 0
                  ? `已完赛${footballStats.total}场 · ${footballMatch.homeTeam}胜${footballStats.homeWins} 平${footballStats.draws} ${footballMatch.awayTeam}胜${footballStats.awayWins}`
                  : '暂无已完赛交锋'}
              </span>
            </div>

            {footballH2H.length === 0 ? (
              <div className="h2h-empty">暂无两队交锋记录</div>
            ) : (
              <div className="fixture-list">
                {footballH2H.map((m) => {
                  const hasScore = m.homeScore !== null && m.awayScore !== null;
                  const homeOutcome: 'win' | 'draw' | 'loss' | null = !hasScore
                    ? null
                    : m.homeScore! > m.awayScore!
                      ? 'win'
                      : m.homeScore! < m.awayScore!
                        ? 'loss'
                        : 'draw';
                  const isCurrent = m.id === footballMatch.id;
                  return (
                    <Link
                      key={m.id}
                      to={`/match/${m.id}`}
                      state={{ sport: 'football', tournamentId: m.tournamentId }}
                      className={`fixture-row fixture-link h2h-row ${isCurrent ? 'is-current-match' : ''}`}
                    >
                      <div className="h2h-row-league">
                        {m.tournamentName} · 第{m.roundNo}轮
                      </div>
                      <div className="fixture-meta tabular-nums">
                        <span>{formatDateTime(m.matchTime).slice(0, 10)}</span>
                        <span>{formatDateTime(m.matchTime).slice(11, 16)}</span>
                      </div>
                      <div className="fixture-players">
                        <div className="fixture-player-line">
                          {teamLogos.get(m.homeTeam) ? (
                            <img
                              className="team-logo"
                              src={teamLogos.get(m.homeTeam)}
                              alt=""
                              loading="lazy"
                            />
                          ) : null}
                          <span>{m.homeTeam}</span>
                        </div>
                        <div className="fixture-player-line">
                          {teamLogos.get(m.awayTeam) ? (
                            <img
                              className="team-logo"
                              src={teamLogos.get(m.awayTeam)}
                              alt=""
                              loading="lazy"
                            />
                          ) : null}
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
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : renjuMatch ? (
        <>
          {(() => {
            const parsed = parseRenjuOutcome(renjuMatch.result);
            return (
              <div className="match-detail-hero">
                <div className="match-detail-time tabular-nums">
                  {formatDateTime(renjuMatch.matchTime)}
                </div>
                <div className="match-detail-board">
                  <Link
                    to={`/player/${encodeURIComponent(renjuMatch.blackId)}`}
                    className="match-detail-side match-detail-side-link"
                  >
                    <div className="match-detail-name">
                      {renjuMatch.blackNo !== undefined ? (
                        <span className="player-no tabular-nums" style={{ marginRight: 6 }}>
                          {renjuMatch.blackNo}
                        </span>
                      ) : null}
                      {renjuMatch.blackName}
                    </div>
                    <div className="match-detail-tag">假先</div>
                  </Link>

                  <div className="match-detail-score tabular-nums">
                    {renjuMatch.result
                      ? `${parsed.blackText} : ${parsed.whiteText}`
                      : 'VS'}
                  </div>

                  <Link
                    to={`/player/${encodeURIComponent(renjuMatch.whiteId)}`}
                    className="match-detail-side match-detail-side-link"
                  >
                    <div className="match-detail-name">
                      {renjuMatch.whiteNo !== undefined ? (
                        <span className="player-no tabular-nums" style={{ marginRight: 6 }}>
                          {renjuMatch.whiteNo}
                        </span>
                      ) : null}
                      {renjuMatch.whiteName}
                    </div>
                    <div className="match-detail-tag">假后</div>
                  </Link>
                </div>
              </div>
            );
          })()}

          <div className="h2h-section">
            <div className="h2h-header">
              <span>历史交锋</span>
              <span className="h2h-summary tabular-nums">
                {renjuStats.total > 0
                  ? `已完赛${renjuStats.total}场 · ${renjuMatch.blackName}胜${renjuStats.aWins} 平${renjuStats.draws} ${renjuMatch.whiteName}胜${renjuStats.bWins}`
                  : '暂无已完赛交锋'}
              </span>
            </div>

            {renjuH2H.length === 0 ? (
              <div className="h2h-empty">暂无两位棋手交锋记录</div>
            ) : (
              <div className="fixture-list">
                {renjuH2H.map((m) => {
                  const parsed = parseRenjuOutcome(m.result);
                  const blackOutcome: 'win' | 'draw' | 'loss' | null =
                    parsed.winner === 'black'
                      ? 'win'
                      : parsed.winner === 'white'
                        ? 'loss'
                        : parsed.winner === 'draw'
                          ? 'draw'
                          : null;
                  const isCurrent = m.id === renjuMatch.id;
                  return (
                    <Link
                      key={m.id}
                      to={`/match/${m.id}`}
                      state={{
                        sport: 'renju',
                        tournamentId: m.tournamentId,
                        isBracket: Boolean(m.stageLabel && !m.stageLabel.includes('第')),
                      }}
                      className={`fixture-row fixture-link h2h-row ${isCurrent ? 'is-current-match' : ''}`}
                    >
                      <div className="h2h-row-league">
                        {m.tournamentName} · {m.stageLabel ?? `第${m.roundNo}轮`}
                      </div>
                      <div className="fixture-meta tabular-nums">
                        <span>{formatDateTime(m.matchTime).slice(0, 10)}</span>
                        <span>{formatDateTime(m.matchTime).slice(11, 16)}</span>
                      </div>
                      <div className="fixture-players">
                        <div className="fixture-player-line">
                          <span>{m.blackName}</span>
                        </div>
                        <div className="fixture-player-line">
                          <span>{m.whiteName}</span>
                        </div>
                      </div>
                      <div className="fixture-scores tabular-nums">
                        <div
                          className={`fixture-score-line ${
                            !m.result
                              ? 'muted'
                              : blackOutcome === 'loss'
                                ? 'loser'
                                : ''
                          }`}
                        >
                          <span>{parsed.blackText}</span>
                          {blackOutcome ? (
                            <span className={`result-dot ${blackOutcome}`}>
                              {OUTCOME_LABEL[blackOutcome]}
                            </span>
                          ) : (
                            <span aria-hidden="true" />
                          )}
                        </div>
                        <div
                          className={`fixture-score-line ${
                            !m.result
                              ? 'muted'
                              : blackOutcome === 'win'
                                ? 'loser'
                                : ''
                          }`}
                        >
                          <span>{parsed.whiteText}</span>
                          <span aria-hidden="true" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
