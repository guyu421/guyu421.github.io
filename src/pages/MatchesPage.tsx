import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { matchService } from '@/services/matchService';
import type { RenjuMatchStatus, TournamentItem } from '@/types/match';

const STATUS_LABEL: Record<RenjuMatchStatus, string> = {
  live: '进行中',
  upcoming: '未开赛',
  finished: '已完赛',
};

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
    <div className="container">
      {loading ? (
        <div className="card" style={{ padding: 24 }}>
          <div className="skeleton" style={{ height: 84 }} />
        </div>
      ) : error ? (
        <EmptyState title="赛事列表加载失败" description={error} />
      ) : tournaments.length === 0 ? (
        <EmptyState
          title="暂无赛事"
          description="请先在 Supabase 执行 schema.sql 初始化赛事数据。"
        />
      ) : (
        <div className="fixture-list">
          {tournaments.map((item) => (
            <Link key={item.id} to={`/matches/${item.id}`} className="fixture-row">
              <div className="fixture-meta">
                <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                  {item.dateRange || '待定'}
                </span>
                <Badge variant={item.status === 'live' ? 'breaking' : 'neutral'}>
                  {STATUS_LABEL[item.status]}
                </Badge>
              </div>

              <div className="fixture-players">
                <div className="fixture-player-line" style={{ whiteSpace: 'normal' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  {item.groupName}
                  {item.location ? ` · ${item.location}` : ''}
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
