import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  Heading2,
  ImagePlus,
  Minus,
  PenLine,
  Pilcrow,
  Quote,
  Trash2,
  Upload,
} from 'lucide-react';
import { type ChangeEvent, type FormEvent, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { newsService } from '@/services/newsService';
import { useAuth } from '@/store/AuthContext';
import type { ArticleContentBlock } from '@/types/news';

type EditorBlock =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'quote'; text: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'image'; src: string; alt: string };

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function PublishArticlePage() {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'renju' | 'football'>('renju');
  const [summary, setSummary] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [blocks, setBlocks] = useState<EditorBlock[]>([
    { id: uid(), type: 'text', text: '' },
  ]);

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const inlineImgInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageBlockIdRef = useRef<string | null>(null);

  const totalChars = useMemo(
    () =>
      blocks.reduce((sum, b) => {
        if (b.type === 'text' || b.type === 'heading' || b.type === 'quote') {
          return sum + b.text.trim().length;
        }
        return sum;
      }, 0),
    [blocks],
  );
  const readMinutes = Math.max(1, Math.ceil(totalChars / 400));

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
            登录后即可使用文章编辑器发布内容，每日首次发布可获得 +50 源点奖励
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

  function addBlock(type: EditorBlock['type']) {
    const newBlock: EditorBlock =
      type === 'divider'
        ? { id: uid(), type: 'divider' }
        : type === 'image'
          ? { id: uid(), type: 'image', src: '', alt: '' }
          : { id: uid(), type, text: '' };
    setBlocks((prev) => [...prev, newBlock]);
  }

  function updateBlockText(id: string, text: string) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id && (b.type === 'text' || b.type === 'heading' || b.type === 'quote')
          ? { ...b, text }
          : b,
      ),
    );
  }

  function updateImageField(id: string, field: 'src' | 'alt', value: string) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id && b.type === 'image' ? { ...b, [field]: value } : b,
      ),
    );
  }

  function moveBlock(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    setBlocks((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function removeBlock(id: string) {
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      return next.length > 0 ? next : [{ id: uid(), type: 'text', text: '' }];
    });
  }

  async function handleCoverFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setUploadingCover(true);
    setError(null);
    try {
      const url = await newsService.uploadArticleImage(user.id, file);
      setCoverImage(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '封面上传失败');
    } finally {
      setUploadingCover(false);
    }
  }

  function triggerInlineImageUpload(blockId: string) {
    pendingImageBlockIdRef.current = blockId;
    inlineImgInputRef.current?.click();
  }

  async function handleInlineFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const targetId = pendingImageBlockIdRef.current;
    e.target.value = '';
    if (!file || !user || !targetId) return;

    setUploadingBlockId(targetId);
    setError(null);
    try {
      const url = await newsService.uploadArticleImage(user.id, file);
      updateImageField(targetId, 'src', url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '图片上传失败');
    } finally {
      setUploadingBlockId(null);
      pendingImageBlockIdRef.current = null;
    }
  }

  function buildPublishBlocks(): ArticleContentBlock[] {
    const result: ArticleContentBlock[] = [];
    for (const b of blocks) {
      if (b.type === 'text') {
        const lines = b.text
          .split(/\r?\n+/)
          .map((l) => l.trim())
          .filter(Boolean);
        result.push(...lines);
      } else if (b.type === 'heading' || b.type === 'quote') {
        if (b.text.trim()) {
          result.push({ type: b.type, text: b.text.trim() });
        }
      } else if (b.type === 'image') {
        if (b.src.trim()) {
          result.push({
            type: 'image',
            src: b.src.trim(),
            alt: b.alt.trim() || undefined,
          });
        }
      } else if (b.type === 'divider') {
        result.push({ type: 'divider' });
      }
    }
    return result;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || submitting) return;

    const cleanTitle = title.trim();
    const contentBlocks = buildPublishBlocks();

    if (!cleanTitle) {
      setError('请输入文章标题');
      return;
    }
    if (contentBlocks.length === 0) {
      setError('请至少填写一段正文或插入一张图片');
      return;
    }

    const firstTextBlock = contentBlocks.find(
      (b) =>
        typeof b === 'string' ||
        b.type === 'text' ||
        b.type === 'heading' ||
        b.type === 'quote',
    );
    const autoSummary =
      typeof firstTextBlock === 'string'
        ? firstTextBlock
        : firstTextBlock && 'text' in firstTextBlock
          ? firstTextBlock.text
          : cleanTitle;

    const cleanSummary = summary.trim() || autoSummary.slice(0, 120);
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
        content: contentBlocks,
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
    fontSize: '0.84rem',
    fontWeight: 700,
    marginBottom: 6,
    color: 'var(--color-text-secondary)',
  } as const;

  const toolBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 10px',
    fontSize: '0.8rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
  } as const;

  const previewBlocks = buildPublishBlocks();

  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleCoverFileChange}
      />
      <input
        ref={inlineImgInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleInlineFileChange}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 14,
        }}
      >
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {totalChars} 字 · 预计阅读 {readMinutes} 分钟
          </span>
          <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            每日首篇 +50 源点
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            paddingBottom: 14,
            marginBottom: 18,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '1.22rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <PenLine size={19} color="var(--color-primary)" />
            文章编辑器
          </h1>

          <div style={{ display: 'inline-flex', gap: 6 }}>
            <button
              type="button"
              className={`category-pill ${mode === 'edit' ? 'active' : ''}`}
              onClick={() => setMode('edit')}
              style={{ padding: '5px 14px', fontSize: '0.82rem' }}
            >
              编辑
            </button>
            <button
              type="button"
              className={`category-pill ${mode === 'preview' ? 'active' : ''}`}
              onClick={() => setMode('preview')}
              style={{
                padding: '5px 14px',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Eye size={13} />
              预览
            </button>
          </div>
        </div>

        {mode === 'preview' ? (
          <div>
            <div style={{ marginBottom: 10 }}>
              <Badge>{category === 'football' ? '足球' : '五子棋'}</Badge>
            </div>
            <h2 style={{ margin: '0 0 12px', fontSize: '1.7rem', lineHeight: 1.35 }}>
              {title.trim() || '（未填写标题）'}
            </h2>
            <div
              style={{
                fontSize: '0.84rem',
                color: 'var(--color-text-muted)',
                marginBottom: 18,
                paddingBottom: 12,
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              {user.username} · 创作者 · 约 {readMinutes} 分钟阅读
            </div>
            {coverImage.trim() ? (
              <img
                src={coverImage.trim()}
                alt={title}
                className="article-cover"
              />
            ) : null}
            {previewBlocks.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>暂无正文内容</p>
            ) : (
              previewBlocks.map((block, idx) => {
                if (typeof block === 'string') {
                  return (
                    <p key={idx} className="article-paragraph">
                      {block}
                    </p>
                  );
                }
                if (block.type === 'heading') {
                  return (
                    <h3
                      key={idx}
                      style={{ margin: '22px 0 10px', fontSize: '1.2rem', fontWeight: 700 }}
                    >
                      {block.text}
                    </h3>
                  );
                }
                if (block.type === 'quote') {
                  return (
                    <blockquote
                      key={idx}
                      style={{
                        margin: '16px 0',
                        padding: '10px 16px',
                        borderLeft: '3px solid var(--color-primary)',
                        background: 'var(--color-surface-muted)',
                        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {block.text}
                    </blockquote>
                  );
                }
                if (block.type === 'divider') {
                  return (
                    <hr
                      key={idx}
                      style={{
                        margin: '20px 0',
                        border: 'none',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    />
                  );
                }
                if (block.type === 'image') {
                  return (
                    <figure key={idx} style={{ margin: '18px 0' }}>
                      <img
                        src={block.src}
                        alt={block.alt || title}
                        style={{
                          width: '100%',
                          borderRadius: 'var(--radius-md)',
                          display: 'block',
                        }}
                      />
                    </figure>
                  );
                }
                return null;
              })
            )}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
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
                placeholder="请输入文章标题..."
                maxLength={120}
                style={{ ...inputStyle, fontSize: '1.06rem', fontWeight: 700 }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14,
              }}
            >
              <div>
                <label style={labelStyle}>所属频道 *</label>
                <div style={{ display: 'flex', gap: 8 }}>
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
                <label htmlFor="pub-tags" style={labelStyle}>
                  标签（选填，逗号或空格分隔）
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
            </div>

            <div>
              <label htmlFor="pub-summary" style={labelStyle}>
                文章摘要（选填，留空则自动截取首段文字）
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
              <label style={labelStyle}>封面图（选填）</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="url"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="粘贴图片链接，或点击右侧上传本地图片"
                  style={{ ...inputStyle, flex: '1 1 240px' }}
                />
                <button
                  type="button"
                  style={toolBtnStyle}
                  disabled={uploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                >
                  <Upload size={14} />
                  {uploadingCover ? '上传中...' : '上传封面'}
                </button>
                {coverImage ? (
                  <button
                    type="button"
                    style={toolBtnStyle}
                    onClick={() => setCoverImage('')}
                  >
                    移除
                  </button>
                ) : null}
              </div>
              {coverImage ? (
                <img
                  src={coverImage}
                  alt="封面预览"
                  style={{
                    marginTop: 10,
                    maxHeight: 200,
                    borderRadius: 'var(--radius-sm)',
                    objectFit: 'cover',
                  }}
                />
              ) : null}
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  正文排版块 *
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button
                    type="button"
                    style={toolBtnStyle}
                    onClick={() => addBlock('text')}
                  >
                    <Pilcrow size={14} />
                    段落
                  </button>
                  <button
                    type="button"
                    style={toolBtnStyle}
                    onClick={() => addBlock('heading')}
                  >
                    <Heading2 size={14} />
                    小标题
                  </button>
                  <button
                    type="button"
                    style={toolBtnStyle}
                    onClick={() => addBlock('quote')}
                  >
                    <Quote size={14} />
                    引用
                  </button>
                  <button
                    type="button"
                    style={toolBtnStyle}
                    onClick={() => addBlock('image')}
                  >
                    <ImagePlus size={14} />
                    图片
                  </button>
                  <button
                    type="button"
                    style={toolBtnStyle}
                    onClick={() => addBlock('divider')}
                  >
                    <Minus size={14} />
                    分割线
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-surface-muted)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: block.type === 'divider' ? 0 : 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {block.type === 'text'
                          ? '正文段落'
                          : block.type === 'heading'
                            ? '小标题'
                            : block.type === 'quote'
                              ? '引用块'
                              : block.type === 'image'
                                ? '图片块'
                                : '分割线'}
                      </span>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          type="button"
                          aria-label="上移"
                          disabled={index === 0}
                          onClick={() => moveBlock(index, -1)}
                          style={{ ...toolBtnStyle, padding: '3px 6px' }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="下移"
                          disabled={index === blocks.length - 1}
                          onClick={() => moveBlock(index, 1)}
                          style={{ ...toolBtnStyle, padding: '3px 6px' }}
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="删除"
                          onClick={() => removeBlock(block.id)}
                          style={{ ...toolBtnStyle, padding: '3px 6px', color: '#dc2626' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {block.type === 'text' ? (
                      <textarea
                        rows={4}
                        value={block.text}
                        onChange={(e) => updateBlockText(block.id, e.target.value)}
                        placeholder="输入正文段落内容（换行会自动分段）..."
                        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65 }}
                      />
                    ) : block.type === 'heading' ? (
                      <input
                        type="text"
                        value={block.text}
                        onChange={(e) => updateBlockText(block.id, e.target.value)}
                        placeholder="输入小标题..."
                        style={{ ...inputStyle, fontWeight: 700 }}
                      />
                    ) : block.type === 'quote' ? (
                      <textarea
                        rows={2}
                        value={block.text}
                        onChange={(e) => updateBlockText(block.id, e.target.value)}
                        placeholder="输入引用文字..."
                        style={{
                          ...inputStyle,
                          borderLeft: '3px solid var(--color-primary)',
                          resize: 'vertical',
                        }}
                      />
                    ) : block.type === 'image' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input
                            type="url"
                            value={block.src}
                            onChange={(e) =>
                              updateImageField(block.id, 'src', e.target.value)
                            }
                            placeholder="粘贴图片链接，或点击右侧上传"
                            style={{ ...inputStyle, flex: '1 1 220px' }}
                          />
                          <button
                            type="button"
                            style={toolBtnStyle}
                            disabled={uploadingBlockId === block.id}
                            onClick={() => triggerInlineImageUpload(block.id)}
                          >
                            <Upload size={13} />
                            {uploadingBlockId === block.id ? '上传中...' : '上传图片'}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={block.alt}
                          onChange={(e) =>
                            updateImageField(block.id, 'alt', e.target.value)
                          }
                          placeholder="图片说明 / Alt（选填）"
                          style={inputStyle}
                        />
                        {block.src ? (
                          <img
                            src={block.src}
                            alt={block.alt || '配图预览'}
                            style={{
                              maxHeight: 200,
                              borderRadius: 'var(--radius-sm)',
                              objectFit: 'contain',
                              alignSelf: 'flex-start',
                            }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
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
        )}
      </div>
    </div>
  );
}
