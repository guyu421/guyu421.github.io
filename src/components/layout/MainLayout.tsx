import { type ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { UnifiedSearchResults } from '@/components/search/UnifiedSearchResults';
import { useAppStore } from '@/store/AppContext';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { Header } from './Header';

export function MainLayout({ children }: { children: ReactNode }) {
  const { searchQuery, setSearchQuery } = useAppStore();
  const location = useLocation();
  const hasSearch = searchQuery.trim().length > 0;
  const isFullscreenEditor = location.pathname === '/publish';

  useEffect(() => {
    setSearchQuery('');
  }, [location.pathname, setSearchQuery]);

  if (isFullscreenEditor) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        {hasSearch ? <UnifiedSearchResults /> : children}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
