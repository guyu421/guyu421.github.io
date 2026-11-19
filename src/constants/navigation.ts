export interface NavLinkItem {
  label: string;
  path: string;
}

export const MAIN_NAV_LINKS: NavLinkItem[] = [
  { label: '足球', path: '/category/football' },
  { label: '篮球', path: '/category/basketball' },
  { label: '网球', path: '/category/tennis' },
  { label: '电竞', path: '/category/esports' },
  { label: '赛车', path: '/category/motorsport' },
];
