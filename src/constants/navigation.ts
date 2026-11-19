export interface NavLinkItem {
  label: string;
  path: string;
}

export const MAIN_NAV_LINKS: NavLinkItem[] = [
  { label: '全部', path: '/category/all' },
  { label: '五子棋', path: '/category/renju' },
  { label: '足球', path: '/category/football' },
];
