import type { SportCategoryId } from './common';

export interface NewsAuthor {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

export type ArticleContentBlock =
  | string
  | { type: 'text'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'divider' }
  | { type: 'table'; rows: string[][] }
  | { type: 'formula'; tex: string }
  | { type: 'image'; src: string; alt?: string };

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: ArticleContentBlock[];
  category: Exclude<SportCategoryId, 'all'>;
  categoryLabel: string;
  coverImage?: string;
  author: NewsAuthor;
  publishedAt: string;
  readTimeMinutes: number;
  views: number;
  isFeatured?: boolean;
  isBreaking?: boolean;
  sourceUrl?: string;
  tags: string[];
}

export interface NewsQueryParams {
  category?: SportCategoryId;
  search?: string;
  limit?: number;
}
