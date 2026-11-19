import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NewsList } from '@/components/news/NewsList';
import { CATEGORY_MAP } from '@/constants/categories';
import { useDebounce } from '@/hooks/useDebounce';
import { useNewsFeed } from '@/hooks/useNewsFeed';
import { matchService } from '@/services/matchService';
import { useAppStore } from '@/store/AppContext';
import type { SportCategoryId } from '@/types/common';
import type { TournamentItem } from '@/types/match';

export function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const { searchQuery } = useAppStore();
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);

  useEffect(() => {
    let active = true;
    matchService
      .getTournaments()
      .then((data) => {
        if (active) setTournaments(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const matchedTournaments = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return [];
    return tournaments.filter((t) => t.name.toLowerCase().includes(q));
  }, [tournaments, debouncedSearch]);

  const validCategory: SportCategoryId =
    categoryId && categoryId in CATEGORY_MAP
      ? (categoryId as SportCategoryId)
      : 'all';

  const meta = CATEGORY_MAP[validCategory];
  const newsState = useNewsFeed({
    category: validCategory,
    search: debouncedSearch,
  });

  return (
    <div className="container">
      <div className="section-header">
        <h1 className="section-title" style={{ fontSize: '1.5rem' }}>
          {meta.label}频道
        </h1>
        <span style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
          共 {newsState.data.length} 篇资讯
        </span>
      </div>

      {matchedTournaments.length > 0 ? (
        <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
          <div
            style={{
              padding: '10px 14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
              borderBottom: '1px solid var(--color-surface-muted)',
            }}
          >
            相关赛事（{matchedTournaments.length}）
          </div>
          <div className="fixture-list">
            {matchedTournaments.map((item) => (
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
        </div>
      ) : null}

      <NewsList
        articles={newsState.data}
        loading={newsState.loading}
        error={newsState.error}
      />
    </div>
  );
}
