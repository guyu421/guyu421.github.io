import { LogOut, Search, User } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AuthModal } from '@/components/auth/AuthModal';
import { MAIN_NAV_LINKS } from '@/constants/navigation';
import { useAppStore } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import type { SportCategoryId } from '@/types/common';
import { cn } from '@/utils/cn';

function extractSportFromPath(path: string): SportCategoryId {
  const seg = path.split('/').pop();
  if (seg === 'renju' || seg === 'football') return seg;
  return 'all';
}

export function Header() {
  const { activeCategory, setActiveCategory, searchQuery, setSearchQuery } =
    useAppStore();
  const { user, openAuthModal, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMatchesRoute = location.pathname.startsWith('/matches');
  const isTournamentDetail = /^\/matches\/\d+/.test(location.pathname);

  function handleNavClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    path: string,
  ) {
    const sport = extractSportFromPath(path);
    setActiveCategory(sport);
    if (isMatchesRoute) {
      e.preventDefault();
      navigate('/matches');
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <NavLink to="/" className="brand-logo">
            <span className="brand-dot" aria-hidden="true" />
            <span>赛源网</span>
          </NavLink>

          {!isTournamentDetail && (
            <nav className="main-nav" aria-label="主导航">
              {MAIN_NAV_LINKS.map((item) => {
                const sport = extractSportFromPath(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item.path)}
                    className={({ isActive }) =>
                      cn(
                        'nav-link',
                        (isMatchesRoute ? activeCategory === sport : isActive) &&
                          'active',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="search-box">
              <Search size={15} className="search-icon" aria-hidden="true" />
              <input
                type="search"
                className="search-input"
                placeholder="搜索球队、赛事或关键词..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="搜索体育资讯"
              />
            </div>

            {user ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#f8fafc',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <User size={14} aria-hidden="true" />
                  {user.username}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  aria-label="退出登录"
                  style={{
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#cbd5e1',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                style={{
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '7px 14px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                登录 / 注册
              </button>
            )}
          </div>
        </div>

        {!isTournamentDetail && (
          <nav className="mobile-nav" aria-label="移动端频道导航">
            <div className="container mobile-nav-inner">
              {MAIN_NAV_LINKS.map((item) => {
                const sport = extractSportFromPath(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item.path)}
                    className={({ isActive }) =>
                      cn(
                        'mobile-nav-link',
                        (isMatchesRoute ? activeCategory === sport : isActive) &&
                          'active',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      <AuthModal />
    </>
  );
}
