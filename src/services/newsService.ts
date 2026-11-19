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
  published_at: string;
  read_time_minutes: number;
  views: number;
  is_featured: boolean;
  is_breaking: boolean;
  source_url: string | null;
  tags: string[];
  user_id?: string | null;
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
    },
    publishedAt: row.published_at,
    readTimeMinutes: row.read_time_minutes,
    views: row.views,
    isFeatured: row.is_featured,
    isBreaking: row.is_breaking,
    sourceUrl: row.source_url ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    userId: row.user_id ?? undefined,
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

    if (!data) return null;

    const article = mapArticle(data as ArticleRow);
    const uid = (data as ArticleRow).user_id;
    if (uid) {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('user_id', uid)
        .maybeSingle();
      if (profileData?.username) {
        article.author.username = profileData.username as string;
      }
    }

    return article;
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

  async uploadArticleImage(userId: string, file: File): Promise<string> {
    const supabase = requireSupabase();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'png';
    const path = `user-articles/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    const { error } = await supabase.storage
      .from('media')
      .upload(path, file, {
        contentType: file.type || 'image/png',
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from('media').getPublicUrl(path);
    return data.publicUrl;
  },

  async createArticle(input: {
    userId: string;
    authorName: string;
    title: string;
    summary: string;
    content: ArticleContentBlock[];
    category: 'renju' | 'football';
    coverImage?: string;
    sourceUrl?: string;
    publishedAt?: string;
    tags?: string[];
  }): Promise<NewsArticle> {
    const supabase = requireSupabase();
    const categoryLabel = input.category === 'football' ? '足球' : '五子棋';
    const totalChars = input.content
      .map((b) =>
        typeof b === 'string'
          ? b
          : b.type === 'text' || b.type === 'heading' || b.type === 'quote'
            ? b.text
            : '',
      )
      .join('').length;
    const readTimeMinutes = Math.max(1, Math.ceil(totalChars / 400));

    const { data, error } = await supabase
      .from('articles')
      .insert({
        user_id: input.userId,
        title: input.title.trim(),
        summary: input.summary.trim(),
        content: input.content,
        category: input.category,
        category_label: categoryLabel,
        cover_image: input.coverImage?.trim() || null,
        source_url: input.sourceUrl?.trim() || null,
        ...(input.publishedAt ? { published_at: input.publishedAt } : {}),
        author_name: input.authorName,
        read_time_minutes: readTimeMinutes,
        tags: input.tags ?? [],
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapArticle(data as ArticleRow);
  },

  async deleteArticle(id: string): Promise<void> {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new Error('无效的文章编号');
    }
    const supabase = requireSupabase();
    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', numericId);

    if (error) {
      throw new Error(error.message);
    }
  },
};
