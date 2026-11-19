import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { matchService } from '@/services/matchService';
import type { RenjuMatch, RenjuMatchStatus, TournamentItem } from '@/types/match';

const STATUS_LABEL: Record<RenjuMatchStatus, string> = {
  live: '进行中',
  upcoming: '未开赛',
  finished: '已完赛',
};

function getDisplayScores(match: RenjuMatch): {
  blackText: string;
  whiteText: string;
  blackWin: boolean;
  whiteWin: boolean;
} {
  if (!match.result) {
    return { blackText: '-', whiteText: '-', blackWin: false, whiteWin: false };
  }
  if (match.result === 'BF' || match.result === 'W' || match.result === '0:1') {
    return { blackText: '0', whiteText: '1', blackWin: false, whiteWin: true };
  }
  if (match.result === 'WF' || match.result === 'B' || match.result === '1:0') {
    return { blackText: '1', whiteText: '0', blackWin: true, whiteWin: false };
  }
  if (match.result === 'D' || match.result === '0.5:0.5') {
    return { blackText: '0.5', whiteText: '0.5', blackWin: false, whiteWin: false };
  }
  return {
    blackText: match.result,
    whiteText: '',
    blackWin: false,
    whiteWin: false,
  };
}

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

  return (
    <div className="container">
      <div className="league-banner">
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
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.35 }}>
            {tournament?.title || '赛事对局'}
          </div>
          {tournament ? (
            <div style={{ fontSize: '0.76rem', opacity: 0.85 }}>
              {tournament.groupName}
              {tournament.location ? ` · ${tournament.location}` : ''}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 24 }}>
          <div className="skeleton" style={{ height: 96 }} />
        </div>
      ) : error ? (
        <EmptyState title="对局加载失败" description={error} />
      ) : matches.length === 0 ? (
        <EmptyState
          title="暂无对局数据"
          description="请先在 Supabase 执行最新的 schema.sql 导入对局数据。"
        />
      ) : (
        <>
          <div className="round-bar">
            <button
              type="button"
              className="round-btn"
              disabled={roundIndex <= 0}
              onClick={() => setSelectedRound(rounds[roundIndex - 1])}
            >
              <ChevronLeft size={15} />
              上一轮
            </button>

            <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>
              第 {selectedRound} 轮（{roundMatches.length} 台）
            </span>

            <button
              type="button"
              className="round-btn"
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
              return (
                <div key={match.id} className="fixture-row">
                  <div className="fixture-meta">
                    <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      第 {match.boardNo} 台
                    </span>
                    <Badge variant={match.status === 'live' ? 'breaking' : 'neutral'}>
                      {STATUS_LABEL[match.status]}
                    </Badge>
                  </div>

                  <div className="fixture-players">
                    <div className="fixture-player-line">
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#0f172a',
                          color: '#ffffff',
                          flexShrink: 0,
                        }}
                      >
                        假先
                      </span>
                      <span>{match.blackName}</span>
                      <span className="fixture-player-id tabular-nums">
                        #{match.blackId}
                      </span>
                    </div>

                    <div className="fixture-player-line">
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          border: '1px solid #cbd5e1',
                          flexShrink: 0,
                        }}
                      >
                        假后
                      </span>
                      <span>{match.whiteName}</span>
                      <span className="fixture-player-id tabular-nums">
                        #{match.whiteId}
                      </span>
                    </div>
                  </div>

                  <div className="fixture-scores tabular-nums">
                    <div
                      className={`fixture-score-line ${
                        !match.result ? 'muted' : ''
                      }`}
                    >
                      <span>{score.blackText}</span>
                      {score.blackWin ? <span className="win-dot">W</span> : null}
                    </div>
                    <div
                      className={`fixture-score-line ${
                        !match.result ? 'muted' : ''
                      }`}
                    >
                      <span>{score.whiteText}</span>
                      {score.whiteWin ? <span className="win-dot">W</span> : null}
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
