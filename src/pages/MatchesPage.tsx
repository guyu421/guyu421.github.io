import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { matchService } from '@/services/matchService';
import type { TournamentItem } from '@/types/match';

export function MatchesPage() {
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    matchService
      .getTournaments()
      .then((data) => {
        if (active) setTournaments(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : '加载赛事列表失败');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="tournament-page">
      <div className="league-banner">
        <div className="container" style={{ padding: 0 }}>
          <div style={{ fontSize: '1.02rem', fontWeight: 700, lineHeight: 1.35 }}>
            赛事
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ margin: 16, padding: 24 }}>
          <div className="skeleton" style={{ height: 84 }} />
        </div>
      ) : error ? (
        <div style={{ padding: 16 }}>
          <EmptyState title="赛事列表加载失败" description={error} />
        </div>
      ) : tournaments.length === 0 ? (
        <div style={{ padding: 16 }}>
          <EmptyState
            title="暂无赛事"
            description="请先在 Supabase 执行 schema.sql 初始化赛事数据。"
          />
        </div>
      ) : (
        <div className="fixture-list">
          {tournaments.map((item) => (
            <Link
              key={item.id}
              to={`/matches/${item.id}`}
              className="fixture-row"
              style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}
            >
              <div className="fixture-players">
                <div className="fixture-player-line" style={{ whiteSpace: 'normal' }}>
                  {item.name}
                </div>
              </div>

              <div className="fixture-scores">
                <ChevronRight size={18} color="var(--color-text-muted)" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
