import { MessageSquare, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { commentService } from '@/services/commentService';
import { useAuth } from '@/store/AuthContext';
import type { CommentItem } from '@/types/auth';
import { formatRelativeTime } from '@/utils/formatDate';

interface AccountCommentsProps {
  articleId: string;
}

export function AccountComments({ articleId }: AccountCommentsProps) {
  const { user, openAuthModal } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    commentService
      .getComments(articleId)
      .then((list) => {
        if (active) setComments(list);
      })
      .catch(() => {
        if (active) setComments([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [articleId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setError(null);
    setSubmitting(true);
    try {
      const created = await commentService.createComment(
        articleId,
        trimmed,
        user?.username,
      );
      setComments((prev) => [created, ...prev]);
      setContent('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '发表评价失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (pendingDeleteId === null || deleting) return;
    setDeleting(true);
    try {
      await commentService.deleteComment(pendingDeleteId);
      setComments((prev) => prev.filter((item) => item.id !== pendingDeleteId));
      setPendingDeleteId(null);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section
      className="card"
      style={{ marginTop: 36, padding: 24 }}
      aria-label="文章评价区"
    >
      <div
        className="section-header"
        style={{
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h2
          className="section-title"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <MessageSquare size={18} aria-hidden="true" />
          文章评价（{comments.length}）
        </h2>
      </div>

      {user ? (
        <form onSubmit={handleSubmit} style={{ marginBottom: 22 }}>
          <textarea
            rows={3}
            maxLength={500}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`以 ${user.username} 的身份发表评价...`}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              fontFamily: 'inherit',
              fontSize: '0.92rem',
              resize: 'vertical',
            }}
          />
          {error ? (
            <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: 'var(--color-live)' }}>
              {error}
            </p>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="category-pill active"
            >
              {submitting ? '发送中...' : '发表评价'}
            </button>
          </div>
        </form>
      ) : (
        <div
          style={{
            padding: '16px 18px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            登录后即可发表评价并参与讨论
          </span>
          <button
            type="button"
            className="category-pill active"
            onClick={openAuthModal}
          >
            登录 / 注册
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
          正在加载评价...
        </p>
      ) : comments.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
          暂无评价，来抢沙发吧。
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {comments.map((item) => (
            <div
              key={item.id}
              style={{
                paddingBottom: 14,
                borderBottom: '1px solid var(--color-surface-muted)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: 'var(--color-text)' }}>{item.username}</strong>
                  <span className="badge badge-breaking">Lv.{item.level}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>
                {user?.id === item.userId ? (
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(item.id)}
                    aria-label="删除评价"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-text-muted)',
                      padding: 2,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.94rem',
                  lineHeight: 1.6,
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {item.content}
              </p>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={pendingDeleteId !== null}
        title="确认删除评论"
        description="确定要删除这条评论吗？删除后无法恢复。"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </section>
  );
}
