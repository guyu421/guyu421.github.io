import type { CommentItem } from '@/types/auth';
import { ApiError, apiRequest } from './apiClient';

const USE_STATIC_DB_EXPORT =
  import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL;
const DISPATCH_ENDPOINT = import.meta.env.VITE_DISPATCH_ENDPOINT ?? '';

export const commentService = {
  async getComments(articleId: string): Promise<CommentItem[]> {
    if (USE_STATIC_DB_EXPORT) {
      try {
        return await apiRequest<CommentItem[]>(
          `/static-api/comments/${encodeURIComponent(articleId)}.json`,
        );
      } catch {
        return [];
      }
    }

    return apiRequest<CommentItem[]>(
      `/api/news/${encodeURIComponent(articleId)}/comments`,
    );
  },

  async createComment(
    articleId: string,
    content: string,
    username?: string,
  ): Promise<CommentItem> {
    if (USE_STATIC_DB_EXPORT) {
      if (!DISPATCH_ENDPOINT) {
        throw new ApiError(
          '当前为纯静态站点，尚未配置异步写入转发层（VITE_DISPATCH_ENDPOINT）或后端 API（VITE_API_BASE_URL）',
          503,
        );
      }

      const res = await fetch(DISPATCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'add-comment',
          client_payload: {
            articleId: Number(articleId),
            username: username || '匿名棋友',
            content,
          },
        }),
      });

      if (!res.ok) {
        throw new ApiError('提交异步写入任务失败，请稍后重试', res.status);
      }

      return {
        id: Date.now(),
        articleId: Number(articleId),
        userId: 'pending',
        username: username || '匿名棋友',
        content,
        createdAt: new Date().toISOString(),
      };
    }

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
