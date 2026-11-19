import { Newspaper, Trophy, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';

const BOTTOM_TABS = [
  { label: '赛事', path: '/matches', Icon: Trophy },
  { label: '资讯', path: '/category/renju', Icon: Newspaper },
  { label: '我的', path: '/profile', Icon: User },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="底部导航栏">
      <div className="bottom-nav-inner">
        {BOTTOM_TABS.map(({ label, path, Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn('bottom-nav-item', isActive && 'active')
            }
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
