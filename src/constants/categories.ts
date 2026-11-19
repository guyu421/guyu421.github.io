import type { SportCategoryId } from '@/types/common';

export interface SportCategoryMeta {
  id: SportCategoryId;
  label: string;
  accentColor: string;
}

export const SPORT_CATEGORIES: SportCategoryMeta[] = [
  { id: 'all', label: '全部资讯', accentColor: '#ef4444' },
  { id: 'renju', label: '五子棋', accentColor: '#d97706' },
  { id: 'football', label: '足球', accentColor: '#10b981' },
];

export const CATEGORY_MAP: Record<SportCategoryId, SportCategoryMeta> =
  SPORT_CATEGORIES.reduce(
    (acc, item) => {
      acc[item.id] = item;
      return acc;
    },
    {} as Record<SportCategoryId, SportCategoryMeta>,
  );
