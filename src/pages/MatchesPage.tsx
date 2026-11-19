import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';
import { matchService } from '@/services/matchService';
import { useAppStore } from '@/store/AppContext';
import type { TournamentItem } from '@/types/match';

export function MatchesPage() {
  const { activeCategory, searchQuery } = useAppStore();
  const debouncedSearch = useDebounce(searchQuery, 200);
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

  const visibleTournaments = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return tournaments.filter((item) => {
      if (activeCategory !== 'all' && item.sport !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return item.name.toLowerCase().includes(q);
    });
  }, [tournaments, activeCategory, debouncedSearch]);

  return (
    <div className="tournament-page">
      {loading ? (
        <div className="card" style={{ margin: 16, padding: 24 }}>
          <div className="skeleton" style={{ height: 84 }} />
        </div>
      ) : error ? (
        <div style={{ padding: 16 }}>
          <EmptyState title="赛事列表加载失败" description={error} />
        </div>
      ) : visibleTournaments.length === 0 ? (
        <div style={{ padding: 16 }}>
          <EmptyState
            title="暂无赛事"
            description="请切换顶部项目分类，或先在 Supabase 执行 schema.sql 初始化赛事数据。"
          />
        </div>
      ) : (
        <div className="fixture-list">
          {visibleTournaments.map((item) => (
            <Link
              key={item.id}
              to={`/matches/${item.id}`}
              className="fixture-row"
              style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}
            >
              <div className="fixture-players">
                <div className="fixture-player-line" style={{ whiteSpace: 'normal' }}>
                  {item.logoUrl ? (
                    <img
                      className="league-logo"
                      src={item.logoUrl}
                      alt=""
                      loading="lazy"
                    />
                  ) : null}
                  <span>{item.name}</span>
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
