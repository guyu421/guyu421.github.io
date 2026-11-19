import type { NewsArticle, NewsQueryParams } from '@/types/news';
import { apiRequest } from './apiClient';

const USE_STATIC_DB_EXPORT =
  import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL;

export const newsService = {
  async getArticles(params: NewsQueryParams = {}): Promise<NewsArticle[]> {
    if (USE_STATIC_DB_EXPORT) {
      const all = await apiRequest<NewsArticle[]>('/static-api/news.json');
      const { category = 'all', search = '', limit } = params;
      const normalized = search.trim().toLowerCase();

      const filtered = all.filter((article) => {
        const matchCategory = category === 'all' || article.category === category;
        const matchSearch =
          !normalized ||
          article.title.toLowerCase().includes(normalized) ||
          article.summary.toLowerCase().includes(normalized) ||
          article.tags.some((t) => t.toLowerCase().includes(normalized));
        return matchCategory && matchSearch;
      });

      return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
    }

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

  async getArticleById(id: string): Promise<NewsArticle | null> {
    if (USE_STATIC_DB_EXPORT) {
      try {
        return await apiRequest<NewsArticle>(`/static-api/news/${encodeURIComponent(id)}.json`);
      } catch {
        return null;
      }
    }

    return apiRequest<NewsArticle | null>(`/api/news/${encodeURIComponent(id)}`);
  },

  async getRelatedArticles(
    currentId: string,
    category: NewsArticle['category'],
    limit = 3,
  ): Promise<NewsArticle[]> {
    if (USE_STATIC_DB_EXPORT) {
      const all = await apiRequest<NewsArticle[]>('/static-api/news.json');
      return all
        .filter((item) => item.id !== currentId && item.category === category)
        .slice(0, limit);
    }

    const query = new URLSearchParams({
      category,
      limit: String(limit),
    });
    return apiRequest<NewsArticle[]>(
      `/api/news/${encodeURIComponent(currentId)}/related?${query.toString()}`,
    );
  },
};
