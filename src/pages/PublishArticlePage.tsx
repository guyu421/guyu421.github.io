import { ArrowLeft, PenLine } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { newsService } from '@/services/newsService';
import { useAuth } from '@/store/AuthContext';

export function PublishArticlePage() {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'renju' | 'football'>('renju');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="container" style={{ maxWidth: 680 }}>
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>发布文章</h1>
          <p
            style={{
              margin: '0 0 20px',
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
            }}
          >
            登录后即可发布文章，每日首次发布可获得 +50 源点奖励
          </p>
          <button
            type="button"
            className="category-pill active"
            onClick={openAuthModal}
            style={{ padding: '9px 22px', fontSize: '0.92rem' }}
          >
            登录 / 注册
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || submitting) return;

    const cleanTitle = title.trim();
    const paragraphs = body
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!cleanTitle) {
      setError('请输入文章标题');
      return;
    }
    if (paragraphs.length === 0) {
      setError('请输入文章正文内容');
      return;
    }

    const cleanSummary =
      summary.trim() || paragraphs[0].slice(0, 120);
    const tags = tagsText
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    setError(null);

    try {
      const created = await newsService.createArticle({
        userId: user.id,
        authorName: user.username,
        title: cleanTitle,
        summary: cleanSummary,
        content: paragraphs,
        category,
        coverImage: coverImage.trim() || undefined,
        tags,
      });
      navigate(`/article/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '发布失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: '0.92rem',
    fontFamily: 'inherit',
  } as const;

  const labelStyle = {
    display: 'block',
    fontSize: '0.86rem',
    fontWeight: 700,
    marginBottom: 6,
    color: 'var(--color-text-secondary)',
  } as const;

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 14 }}>
        <Link
          to="/profile"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.88rem',
            color: 'var(--color-text-muted)',
          }}
        >
          <ArrowLeft size={15} />
          返回我的主页
        </Link>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '1.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <PenLine size={20} color="var(--color-primary)" />
            发布文章
          </h1>
          <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            每日首篇 +50 源点
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div>
            <label htmlFor="pub-title" style={labelStyle}>
              文章标题 *
            </label>
            <input
              id="pub-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入清晰、有吸引力的标题"
              maxLength={120}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>所属频道 *</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className={`category-pill ${category === 'renju' ? 'active' : ''}`}
                onClick={() => setCategory('renju')}
              >
                五子棋
              </button>
              <button
                type="button"
                className={`category-pill ${category === 'football' ? 'active' : ''}`}
                onClick={() => setCategory('football')}
              >
                足球
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="pub-summary" style={labelStyle}>
              文章摘要（选填，留空则自动截取正文首段）
            </label>
            <input
              id="pub-summary"
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="一句话概括文章核心内容"
              maxLength={200}
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="pub-body" style={labelStyle}>
              文章正文 *（换行自动分段）
            </label>
            <textarea
              id="pub-body"
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="请输入文章正文内容..."
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65 }}
            />
          </div>

          <div>
            <label htmlFor="pub-cover" style={labelStyle}>
              封面图链接（选填）
            </label>
            <input
              id="pub-cover"
              type="url"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="pub-tags" style={labelStyle}>
              标签（选填，多个标签用逗号或空格分隔）
            </label>
            <input
              id="pub-tags"
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="例如：中超 战术复盘"
              style={inputStyle}
            />
          </div>

          {error ? (
            <p
              style={{
                margin: 0,
                color: '#dc2626',
                fontSize: '0.86rem',
                fontWeight: 600,
              }}
            >
              {error}
            </p>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Link to="/profile" className="category-pill">
              取消
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="category-pill active"
              style={{ padding: '8px 22px', fontSize: '0.92rem' }}
            >
              {submitting ? '发布中...' : '发布文章'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
