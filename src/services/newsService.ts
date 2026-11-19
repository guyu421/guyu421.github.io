import { RENJU_NEWS } from '@/data/renjuNews';
import type { NewsArticle, NewsQueryParams } from '@/types/news';
import { apiRequest } from './apiClient';

const HAS_BACKEND_API = Boolean(import.meta.env.VITE_API_BASE_URL);

export const newsService = {
  async getArticles(params: NewsQueryParams = {}): Promise<NewsArticle[]> {
    if (HAS_BACKEND_API) {
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
    }

    const { category = 'all', search = '', limit } = params;
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = RENJU_NEWS.filter((article) => {
      const matchCategory = category === 'all' || article.category === category;
      const matchSearch =
        !normalizedSearch ||
        article.title.toLowerCase().includes(normalizedSearch) ||
        article.summary.toLowerCase().includes(normalizedSearch) ||
        article.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));
      return matchCategory && matchSearch;
    });

    return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
  },

  async getArticleBySlug(slug: string): Promise<NewsArticle | null> {
    if (HAS_BACKEND_API) {
      return apiRequest<NewsArticle | null>(`/api/news/${encodeURIComponent(slug)}`);
    }

    return RENJU_NEWS.find((article) => article.slug === slug) ?? null;
  },

  async getRelatedArticles(
    currentId: string,
    category: NewsArticle['category'],
    limit = 3,
  ): Promise<NewsArticle[]> {
    if (HAS_BACKEND_API) {
      const query = new URLSearchParams({
        category,
        limit: String(limit),
      });
      return apiRequest<NewsArticle[]>(
        `/api/news/${encodeURIComponent(currentId)}/related?${query.toString()}`,
      );
    }

    return RENJU_NEWS.filter(
      (item) => item.id !== currentId && item.category === category,
    ).slice(0, limit);
  },
};
