import { ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { matchService } from '@/services/matchService';
import type { FootballMatch, PlayerInfo, RenjuMatch } from '@/types/match';

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

export function ParticipantProfilePage({ kind }: { kind: 'team' | 'player' }) {
  const { teamName, playerId } = useParams<{
    teamName?: string;
    playerId?: string;
  }>();
  const navigate = useNavigate();
  const decodedTeamName = teamName ? decodeURIComponent(teamName) : '';
  const decodedPlayerId = playerId ? decodeURIComponent(playerId) : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamLogoUrl, setTeamLogoUrl] = useState<string | undefined>(undefined);
  const [teamLogos, setTeamLogos] = useState<Map<string, string>>(new Map());
  const [footballMatches, setFootballMatches] = useState<
    Array<FootballMatch & { tournamentName: string }>
  >([]);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [renjuMatches, setRenjuMatches] = useState<
    Array<RenjuMatch & { tournamentName: string; stageLabel?: string }>
  >([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    if (kind === 'team') {
      if (!decodedTeamName) {
        setLoading(false);
        return;
      }
      matchService
        .getTeamProfile(decodedTeamName)
        .then((res) => {
          if (!active) return;
          setTeamLogoUrl(res.logoUrl);
          setTeamLogos(res.teamLogos);
          setFootballMatches(res.matches);
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : '加载球队主页失败');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      if (!decodedPlayerId) {
        setLoading(false);
        return;
      }
      matchService
        .getPlayerProfile(decodedPlayerId)
        .then((res) => {
          if (!active) return;
          setPlayerInfo(res.player);
          setRenjuMatches(res.matches);
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : '加载棋手主页失败');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [kind, decodedTeamName, decodedPlayerId]);

  const teamStats = useMemo(() => {
    let played = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let gf = 0;
    let ga = 0;
    for (const m of footballMatches) {
      if (m.homeScore === null || m.awayScore === null) continue;
      played += 1;
      const isHome = m.homeTeam === decodedTeamName;
      const myScore = isHome ? m.homeScore : m.awayScore;
      const oppScore = isHome ? m.awayScore : m.homeScore;
      gf += myScore;
      ga += oppScore;
      if (myScore > oppScore) wins += 1;
      else if (myScore < oppScore) losses += 1;
      else draws += 1;
    }
    return { played, wins, draws, losses, gf, ga };
  }, [footballMatches, decodedTeamName]);

  const playerStats = useMemo(() => {
    let played = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    for (const m of renjuMatches) {
      const parsed = parseRenjuOutcome(m.result);
      if (!parsed.winner) continue;
      played += 1;
      if (parsed.winner === 'draw') {
        draws += 1;
      } else {
        const isBlack = m.blackId === decodedPlayerId;
        const won =
          (isBlack && parsed.winner === 'black') ||
          (!isBlack && parsed.winner === 'white');
        if (won) wins += 1;
        else losses += 1;
      }
    }
    return { played, wins, draws, losses };
  }, [renjuMatches, decodedPlayerId]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 20 }}>
        <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 240 }} />
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

  const displayName = kind === 'team' ? decodedTeamName : playerInfo?.name ?? '';
  if (!displayName) {
    return (
      <div className="container" style={{ paddingTop: 20 }}>
        <EmptyState title="未找到主页" description="该球队或棋手不存在。" />
      </div>
    );
  }

  return (
    <div className="tournament-page">
      <div className="league-banner">
        <div
          className="container"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 0 }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="返回上一页"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {kind === 'team' && teamLogoUrl ? (
              <img src={teamLogoUrl} alt={displayName} className="league-logo" />
            ) : null}
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{displayName}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="h2h-section" style={{ marginTop: 0 }}>
        <div className="h2h-header">
          <span>全部战绩</span>
          <span className="h2h-summary tabular-nums">
            {kind === 'team'
              ? `已完赛${teamStats.played}场 · ${teamStats.wins}胜 ${teamStats.draws}平 ${teamStats.losses}负 · 进${teamStats.gf}球 失${teamStats.ga}球`
              : `已完赛${playerStats.played}场 · ${playerStats.wins}胜 ${playerStats.draws}平 ${playerStats.losses}负`}
          </span>
        </div>

        {kind === 'team' ? (
          footballMatches.length === 0 ? (
            <div className="h2h-empty">暂无该球队的比赛记录</div>
          ) : (
            <div className="fixture-list">
              {footballMatches.map((m) => {
                const hasScore = m.homeScore !== null && m.awayScore !== null;
                const isHome = m.homeTeam === decodedTeamName;
                const myScore = hasScore ? (isHome ? m.homeScore! : m.awayScore!) : null;
                const oppScore = hasScore ? (isHome ? m.awayScore! : m.homeScore!) : null;
                const myOutcome: 'win' | 'draw' | 'loss' | null = !hasScore
                  ? null
                  : myScore! > oppScore!
                    ? 'win'
                    : myScore! < oppScore!
                      ? 'loss'
                      : 'draw';
                const homeLost = hasScore && m.homeScore! < m.awayScore!;
                const awayLost = hasScore && m.awayScore! < m.homeScore!;
                return (
                  <Link
                    key={m.id}
                    to={`/${m.tournamentId}/match/${m.id}`}
                    className="fixture-row fixture-link h2h-row"
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
                        <span style={isHome ? { fontWeight: 800 } : undefined}>
                          {m.homeTeam}
                        </span>
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
                        <span style={!isHome ? { fontWeight: 800 } : undefined}>
                          {m.awayTeam}
                        </span>
                      </div>
                    </div>
                    <div className="fixture-scores tabular-nums">
                      <div
                        className={`fixture-score-line ${
                          !hasScore ? 'muted' : homeLost ? 'loser' : ''
                        }`}
                      >
                        <span>{hasScore ? m.homeScore : '-'}</span>
                        {isHome && myOutcome ? (
                          <span className={`result-dot ${myOutcome}`}>
                            {OUTCOME_LABEL[myOutcome]}
                          </span>
                        ) : (
                          <span aria-hidden="true" />
                        )}
                      </div>
                      <div
                        className={`fixture-score-line ${
                          !hasScore ? 'muted' : awayLost ? 'loser' : ''
                        }`}
                      >
                        <span>{hasScore ? m.awayScore : '-'}</span>
                        {!isHome && myOutcome ? (
                          <span className={`result-dot ${myOutcome}`}>
                            {OUTCOME_LABEL[myOutcome]}
                          </span>
                        ) : (
                          <span aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        ) : renjuMatches.length === 0 ? (
          <div className="h2h-empty">暂无该棋手的对局记录</div>
        ) : (
          <div className="fixture-list">
            {renjuMatches.map((m) => {
              const parsed = parseRenjuOutcome(m.result);
              const isBlack = m.blackId === decodedPlayerId;
              const myOutcome: 'win' | 'draw' | 'loss' | null = !parsed.winner
                ? null
                : parsed.winner === 'draw'
                  ? 'draw'
                  : (isBlack && parsed.winner === 'black') ||
                      (!isBlack && parsed.winner === 'white')
                    ? 'win'
                    : 'loss';
              const isBye = m.whiteId === 'BYE' || m.blackId === 'BYE';
              const targetId = m.id > 0 ? m.id : -m.id - 1000;
              const inner = (
                <>
                  <div className="h2h-row-league">
                    {m.tournamentName} · {m.stageLabel ?? `第${m.roundNo}轮`}
                  </div>
                  <div className="fixture-meta tabular-nums">
                    <span>{formatDateTime(m.matchTime).slice(0, 10)}</span>
                    <span>{formatDateTime(m.matchTime).slice(11, 16)}</span>
                  </div>
                  <div className="fixture-players">
                    <div className="fixture-player-line">
                      <span style={isBlack ? { fontWeight: 800 } : undefined}>
                        {m.blackName}
                      </span>
                    </div>
                    <div className="fixture-player-line">
                      <span style={!isBlack ? { fontWeight: 800 } : undefined}>
                        {m.whiteName}
                      </span>
                    </div>
                  </div>
                  <div className="fixture-scores tabular-nums">
                    <div
                      className={`fixture-score-line ${
                        !m.result ? 'muted' : parsed.winner === 'white' ? 'loser' : ''
                      }`}
                    >
                      <span>{parsed.blackText}</span>
                      {isBlack && myOutcome ? (
                        <span className={`result-dot ${myOutcome}`}>
                          {OUTCOME_LABEL[myOutcome]}
                        </span>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </div>
                    <div
                      className={`fixture-score-line ${
                        !m.result ? 'muted' : parsed.winner === 'black' ? 'loser' : ''
                      }`}
                    >
                      <span>{parsed.whiteText}</span>
                      {!isBlack && myOutcome ? (
                        <span className={`result-dot ${myOutcome}`}>
                          {OUTCOME_LABEL[myOutcome]}
                        </span>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </div>
                  </div>
                </>
              );

              return isBye ? (
                <div key={m.id} className="fixture-row h2h-row">
                  {inner}
                </div>
              ) : (
                <Link
                  key={m.id}
                  to={`/${m.tournamentId}/match/${targetId}`}
                  className="fixture-row fixture-link h2h-row"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
