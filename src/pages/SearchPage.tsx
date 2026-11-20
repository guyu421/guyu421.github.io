import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UnifiedSearchResults } from '@/components/search/UnifiedSearchResults';
import { useAppStore } from '@/store/AppContext';
import type { SportCategoryId } from '@/types/common';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const qParam = searchParams.get('q') ?? '';
  const categoryParam = searchParams.get('category');
  const { setSearchQuery, setActiveCategory } = useAppStore();

  useEffect(() => {
    setSearchQuery(qParam);
  }, [qParam, setSearchQuery]);

  useEffect(() => {
    if (
      categoryParam === 'all' ||
      categoryParam === 'renju' ||
      categoryParam === 'football'
    ) {
      setActiveCategory(categoryParam as SportCategoryId);
    }
  }, [categoryParam, setActiveCategory]);

  return <UnifiedSearchResults />;
}
