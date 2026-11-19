import { requireSupabase } from '@/lib/supabase';
import type { CommentItem } from '@/types/auth';

interface CommentRow {
  id: number;
  article_id: number;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

function mapComment(row: CommentRow): CommentItem {
  return {
    id: row.id,
    articleId: row.article_id,
    userId: row.user_id,
    username: row.username,
    content: row.content,
    createdAt: row.created_at,
  };
}

export const commentService = {
  async getComments(articleId: string): Promise<CommentItem[]> {
    const numericId = Number(articleId);
    if (!Number.isInteger(numericId) || numericId <= 0) return [];

    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('article_id', numericId)
      .order('id', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as CommentRow[]).map(mapComment);
  },

  async createComment(
    articleId: string,
    content: string,
    username?: string,
  ): Promise<CommentItem> {
    const supabase = requireSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('请先登录账号');
    }

    const displayName =
      username ||
      (user.user_metadata?.username as string | undefined) ||
      user.email?.split('@')[0] ||
      '球友';

    const { data, error } = await supabase
      .from('comments')
      .insert({
        article_id: Number(articleId),
        user_id: user.id,
        username: displayName,
        content,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapComment(data as CommentRow);
  },

  async deleteComment(commentId: number): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      throw new Error(error.message);
    }
  },
};
