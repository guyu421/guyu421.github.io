import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { matchService } from '@/services/matchService';
import type { RenjuMatch, TournamentItem } from '@/types/match';

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

export function TournamentDetailPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const numericId = Number(tournamentId);

  const [tournament, setTournament] = useState<TournamentItem | null>(null);
  const [matches, setMatches] = useState<RenjuMatch[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(1);
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

    Promise.all([
      matchService.getTournamentById(numericId),
      matchService.getMatchesByTournament(numericId),
    ])
      .then(([tData, mData]) => {
        if (!active) return;
        setTournament(tData);
        setMatches(mData);
        if (mData.length > 0) {
          setSelectedRound(mData[0].roundNo);
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

  const rounds = useMemo(() => {
    const set = new Set(matches.map((m) => m.roundNo));
    return Array.from(set).sort((a, b) => a - b);
  }, [matches]);

  const roundIndex = rounds.indexOf(selectedRound);
  const roundMatches = useMemo(
    () => matches.filter((m) => m.roundNo === selectedRound),
    [matches, selectedRound],
  );

  const prevScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches) {
      if (m.roundNo >= selectedRound || !m.result) continue;
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
  }, [matches, selectedRound]);

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

      {loading ? (
        <div className="card" style={{ margin: 16, padding: 24 }}>
          <div className="skeleton" style={{ height: 96 }} />
        </div>
      ) : error ? (
        <div style={{ padding: 16 }}>
          <EmptyState title="对局加载失败" description={error} />
        </div>
      ) : matches.length === 0 ? (
        <div style={{ padding: 16 }}>
          <EmptyState
            title="暂无对局数据"
            description="请先在 Supabase 执行最新的 schema.sql 导入对局数据。"
          />
        </div>
      ) : (
        <>
          <div className="round-bar" style={{ borderBottom: '1px solid var(--color-surface-muted)', paddingBottom: 10 }}>
            <button
              type="button"
              className="round-btn left"
              disabled={roundIndex <= 0}
              onClick={() => setSelectedRound(rounds[roundIndex - 1])}
            >
              <ChevronLeft size={15} />
              上一轮
            </button>

            <span>第{selectedRound}轮</span>

            <button
              type="button"
              className="round-btn right"
              disabled={roundIndex === -1 || roundIndex >= rounds.length - 1}
              onClick={() => setSelectedRound(rounds[roundIndex + 1])}
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
                      <span>{match.blackName}</span>
                      <span className="fixture-player-id tabular-nums">
                        {prevScores.get(match.blackId) ?? 0}
                      </span>
                    </div>

                    <div className="fixture-player-line">
                      <span>{match.whiteName}</span>
                      <span className="fixture-player-id tabular-nums">
                        {prevScores.get(match.whiteId) ?? 0}
                      </span>
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
