import type { SportCategoryId } from '@/types/common';

export interface SportCategoryMeta {
  id: SportCategoryId;
  label: string;
  accentColor: string;
}

export const SPORT_CATEGORIES: SportCategoryMeta[] = [
  { id: 'all', label: '全部资讯', accentColor: '#ef4444' },
  { id: 'football', label: '足球', accentColor: '#10b981' },
  { id: 'basketball', label: '篮球', accentColor: '#f59e0b' },
  { id: 'tennis', label: '网球', accentColor: '#84cc16' },
  { id: 'esports', label: '电竞', accentColor: '#8b5cf6' },
  { id: 'motorsport', label: '赛车', accentColor: '#06b6d4' },
];

export const CATEGORY_MAP: Record<SportCategoryId, SportCategoryMeta> =
  SPORT_CATEGORIES.reduce(
    (acc, item) => {
      acc[item.id] = item;
      return acc;
    },
    {} as Record<SportCategoryId, SportCategoryMeta>,
  );
