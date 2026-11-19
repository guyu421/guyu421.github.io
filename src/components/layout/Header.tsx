import { Search } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { MAIN_NAV_LINKS } from '@/constants/navigation';
import { useAppStore } from '@/store/AppContext';
import { cn } from '@/utils/cn';

export function Header() {
  const { searchQuery, setSearchQuery } = useAppStore();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <NavLink to="/" className="brand-logo">
          <span className="brand-dot" aria-hidden="true" />
          <span>赛源网</span>
        </NavLink>

        <nav className="main-nav" aria-label="主导航">
          {MAIN_NAV_LINKS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn('nav-link', isActive && 'active')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

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
      </div>
    </header>
  );
}
