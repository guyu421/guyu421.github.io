import { type ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/AppContext';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { Header } from './Header';

export function MainLayout({ children }: { children: ReactNode }) {
  const { setSearchQuery } = useAppStore();
  const location = useLocation();
  const isFullscreenEditor = location.pathname === '/publish';

  useEffect(() => {
    if (location.pathname !== '/search') {
      setSearchQuery('');
    }
  }, [location.pathname, setSearchQuery]);

  if (isFullscreenEditor) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">{children}</main>
      <Footer />
      <BottomNav />
    </div>
  );
}
