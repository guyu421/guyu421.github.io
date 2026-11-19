import { requireSupabase } from '@/lib/supabase';
import type { ArticleContentBlock, NewsArticle, NewsQueryParams } from '@/types/news';

interface ArticleRow {
  id: number;
  title: string;
  summary: string;
  content: ArticleContentBlock[];
  category: NewsArticle['category'];
  category_label: string;
  cover_image: string | null;
  author_name: string;
  author_role: string;
  published_at: string;
  read_time_minutes: number;
  views: number;
  is_featured: boolean;
  is_breaking: boolean;
  source_url: string | null;
  tags: string[];
}

function mapArticle(row: ArticleRow): NewsArticle {
  return {
    id: String(row.id),
    slug: String(row.id),
    title: row.title,
    summary: row.summary,
    content: Array.isArray(row.content) ? row.content : [],
    category: row.category,
    categoryLabel: row.category_label,
    coverImage: row.cover_image ?? undefined,
    author: {
      id: 'author',
      name: row.author_name,
      role: row.author_role,
    },
    publishedAt: row.published_at,
    readTimeMinutes: row.read_time_minutes,
    views: row.views,
    isFeatured: row.is_featured,
    isBreaking: row.is_breaking,
    sourceUrl: row.source_url ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

export const newsService = {
  async getArticles(params: NewsQueryParams = {}): Promise<NewsArticle[]> {
    const supabase = requireSupabase();
    let query = supabase
      .from('articles')
      .select('*')
      .order('id', { ascending: false });

    if (params.category && params.category !== 'all') {
      query = query.eq('category', params.category);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const mapped = (data as ArticleRow[]).map(mapArticle);
    const search = params.search?.trim().toLowerCase() ?? '';
    const filtered = search
      ? mapped.filter(
          (item) =>
            item.title.toLowerCase().includes(search) ||
            item.summary.toLowerCase().includes(search) ||
            item.tags.some((t) => t.toLowerCase().includes(search)),
        )
      : mapped;

    return typeof params.limit === 'number'
      ? filtered.slice(0, params.limit)
      : filtered;
  },

  async getArticleById(id: string): Promise<NewsArticle | null> {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return null;
    }

    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', numericId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapArticle(data as ArticleRow) : null;
  },

  async getRelatedArticles(
    currentId: string,
    category: NewsArticle['category'],
    limit = 3,
  ): Promise<NewsArticle[]> {
    const numericId = Number(currentId);
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .neq('id', numericId)
      .eq('category', category)
      .order('id', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    return (data as ArticleRow[]).map(mapArticle);
  },
};
