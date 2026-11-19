import { PenLine } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { NewsList } from '@/components/news/NewsList';
import { CATEGORY_MAP } from '@/constants/categories';
import { useNewsFeed } from '@/hooks/useNewsFeed';
import { useAuth } from '@/store/AuthContext';
import type { SportCategoryId } from '@/types/common';

export function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const { user } = useAuth();

  const validCategory: SportCategoryId =
    categoryId && categoryId in CATEGORY_MAP
      ? (categoryId as SportCategoryId)
      : 'all';

  const meta = CATEGORY_MAP[validCategory];
  const newsState = useNewsFeed({
    category: validCategory,
    search: '',
  });

  return (
    <div className="container">
      <div className="section-header">
        <h1 className="section-title" style={{ fontSize: '1.5rem' }}>
          {meta.label}频道
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
            共 {newsState.data.length} 篇资讯
          </span>
          {user ? (
            <Link
              to="/publish"
              className="category-pill active"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                fontSize: '0.82rem',
              }}
            >
              <PenLine size={13} />
              发布文章
            </Link>
          ) : null}
        </div>
      </div>

      <NewsList
        articles={newsState.data}
        loading={newsState.loading}
        error={newsState.error}
      />
    </div>
  );
}
