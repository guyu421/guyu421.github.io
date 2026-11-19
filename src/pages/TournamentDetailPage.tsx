import { ArrowLeft, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { matchService } from '@/services/matchService';
import type { RenjuMatch, TournamentItem } from '@/types/match';

export function TournamentDetailPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const numericId = Number(tournamentId);

  const [tournament, setTournament] = useState<TournamentItem | null>(null);
  const [matches, setMatches] = useState<RenjuMatch[]>([]);
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

  return (
    <div className="container">
      <Link
        to="/matches"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.9rem',
          color: 'var(--color-text-secondary)',
          marginBottom: 16,
          fontWeight: 600,
        }}
      >
        <ArrowLeft size={16} />
        返回赛事列表
      </Link>

      {tournament ? (
        <div
          className="card"
          style={{
            padding: '18px 20px',
            marginBottom: 20,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Trophy size={18} color="#f59e0b" aria-hidden="true" />
            <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>
              {tournament.groupName}
              {tournament.location ? ` · ${tournament.location}` : ''}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
            {tournament.title}
          </h1>
        </div>
      ) : null}

      <div className="section-header" style={{ marginBottom: 14 }}>
        <h2 className="section-title">对局列表</h2>
        <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
          共 {matches.length} 场
        </span>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 24 }}>
          <div className="skeleton" style={{ height: 84 }} />
        </div>
      ) : error ? (
        <EmptyState title="对局加载失败" description={error} />
      ) : matches.length === 0 ? (
        <EmptyState
          title="暂无对局数据"
          description="请先在 Supabase 执行最新的 schema.sql 导入对局数据。"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {matches.map((match) => (
            <div key={match.id} className="match-score-card">
              <div className="match-score-header">
                <span>
                  第 {match.roundNo} 轮 · 第 {match.boardNo} 台
                </span>
              </div>

              <div className="match-score-body">
                <div style={{ textAlign: 'right' }}>
                  <div className="match-player home">
                    <span>{match.blackName}</span>
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
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      marginTop: 2,
                    }}
                  >
                    ID: {match.blackId}
                  </div>
                </div>

                <div className="score-pill tabular-nums">
                  {match.result || 'VS'}
                </div>

                <div style={{ textAlign: 'left' }}>
                  <div className="match-player">
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
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      marginTop: 2,
                    }}
                  >
                    ID: {match.whiteId}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
