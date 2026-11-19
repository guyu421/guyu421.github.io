import { useNavigate, useParams } from 'react-router-dom';
import { CategoryNav } from '@/components/layout/CategoryNav';
import { NewsList } from '@/components/news/NewsList';
import { CATEGORY_MAP } from '@/constants/categories';
import { useDebounce } from '@/hooks/useDebounce';
import { useNewsFeed } from '@/hooks/useNewsFeed';
import { useAppStore } from '@/store/AppContext';
import type { SportCategoryId } from '@/types/common';

export function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { searchQuery } = useAppStore();
  const debouncedSearch = useDebounce(searchQuery, 250);

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
    <>
      <CategoryNav
        activeCategory={validCategory}
        onSelect={(next) => navigate(`/category/${next}`)}
      />

      <div className="container" style={{ marginTop: 20 }}>
        <div className="section-header">
          <h1 className="section-title" style={{ fontSize: '1.5rem' }}>
            {meta.label}频道
          </h1>
          <span style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
            共 {newsState.data.length} 篇资讯
          </span>
        </div>

        <NewsList
          articles={newsState.data}
          loading={newsState.loading}
          error={newsState.error}
        />
      </div>
    </>
  );
}
