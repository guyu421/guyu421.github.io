import type { SportCategoryId } from './common';

export interface NewsAuthor {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string[];
  category: Exclude<SportCategoryId, 'all'>;
  categoryLabel: string;
  coverImage: string;
  author: NewsAuthor;
  publishedAt: string;
  readTimeMinutes: number;
  views: number;
  isFeatured?: boolean;
  isBreaking?: boolean;
  tags: string[];
}

export interface NewsQueryParams {
  category?: SportCategoryId;
  search?: string;
  limit?: number;
}
