import { requireSupabase } from '@/lib/supabase';
import type { CommentItem } from '@/types/auth';
import { getLevelInfo } from '@/utils/level';

interface CommentRow {
  id: number;
  article_id: number;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

function mapComment(row: CommentRow, level: number): CommentItem {
  return {
    id: row.id,
    articleId: row.article_id,
    userId: row.user_id,
    username: row.username,
    level,
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

    const rows = data as CommentRow[];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const levelMap = new Map<string, number>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, source_points')
        .in('user_id', userIds);

      if (profiles) {
        for (const p of profiles) {
          const pts = (p.source_points as number) ?? 0;
          levelMap.set(p.user_id as string, getLevelInfo(pts).level);
        }
      }
    }

    return rows.map((row) => mapComment(row, levelMap.get(row.user_id) ?? 1));
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

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('source_points')
      .eq('user_id', user.id)
      .maybeSingle();

    const level = getLevelInfo((profile?.source_points as number) ?? 0).level;
    return mapComment(data as CommentRow, level);
  },

  async deleteComment(commentId: number): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      throw new Error(error.message);
    }
  },
};
