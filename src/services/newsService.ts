import type { NewsArticle, NewsQueryParams } from '@/types/news';
import { apiRequest } from './apiClient';

export const newsService = {
  async getArticles(params: NewsQueryParams = {}): Promise<NewsArticle[]> {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'all') {
      query.set('category', params.category);
    }
    if (params.search?.trim()) {
      query.set('search', params.search.trim());
    }
    if (typeof params.limit === 'number') {
      query.set('limit', String(params.limit));
    }

    const qs = query.toString();
    return apiRequest<NewsArticle[]>(`/api/news${qs ? `?${qs}` : ''}`);
  },

  async getArticleBySlug(slug: string): Promise<NewsArticle | null> {
    return apiRequest<NewsArticle | null>(`/api/news/${encodeURIComponent(slug)}`);
  },

  async getRelatedArticles(
    currentId: string,
    category: NewsArticle['category'],
    limit = 3,
  ): Promise<NewsArticle[]> {
    const query = new URLSearchParams({
      category,
      limit: String(limit),
    });
    return apiRequest<NewsArticle[]>(
      `/api/news/${encodeURIComponent(currentId)}/related?${query.toString()}`,
    );
  },
};
