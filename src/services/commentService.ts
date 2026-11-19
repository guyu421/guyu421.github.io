import type { CommentItem } from '@/types/auth';
import { apiRequest } from './apiClient';

export const commentService = {
  async getComments(articleId: string): Promise<CommentItem[]> {
    return apiRequest<CommentItem[]>(
      `/api/news/${encodeURIComponent(articleId)}/comments`,
    );
  },

  async createComment(articleId: string, content: string): Promise<CommentItem> {
    return apiRequest<CommentItem>(
      `/api/news/${encodeURIComponent(articleId)}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      },
    );
  },

  async deleteComment(commentId: number): Promise<{ ok: boolean }> {
    return apiRequest<{ ok: boolean }>(`/api/comments/${commentId}`, {
      method: 'DELETE',
    });
  },
};
