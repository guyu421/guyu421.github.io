import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UnifiedSearchResults } from '@/components/search/UnifiedSearchResults';
import { useAppStore } from '@/store/AppContext';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const qParam = searchParams.get('q') ?? '';
  const { setSearchQuery } = useAppStore();

  useEffect(() => {
    setSearchQuery(qParam);
  }, [qParam, setSearchQuery]);

  return <UnifiedSearchResults />;
}
