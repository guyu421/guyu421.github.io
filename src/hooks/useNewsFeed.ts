import { useEffect, useState } from 'react';
import { newsService } from '@/services/newsService';
import type { AsyncState } from '@/types/common';
import type { NewsArticle, NewsQueryParams } from '@/types/news';

export function useNewsFeed(params: NewsQueryParams): AsyncState<NewsArticle[]> {
  const [state, setState] = useState<AsyncState<NewsArticle[]>>({
    data: [],
    loading: true,
    error: null,
  });

  const { category = 'all', search = '', limit } = params;

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    newsService
      .getArticles({ category, search, limit })
      .then((articles) => {
        if (!active) return;
        setState({ data: articles, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : '加载资讯失败';
        setState({ data: [], loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [category, search, limit]);

  return state;
}
