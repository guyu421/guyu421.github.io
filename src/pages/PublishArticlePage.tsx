import {
  AlignCenter,
  AlignLeft,
  ArrowLeft,
  Bold,
  Eye,
  Heading2,
  ImagePlus,
  Italic,
  Minus,
  Pilcrow,
  Quote,
  Sigma,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import katex from 'katex';
import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { newsService } from '@/services/newsService';
import { useAuth } from '@/store/AuthContext';
import type { ArticleContentBlock } from '@/types/news';
import { renderTextWithMath } from '@/utils/math';

function extractInlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  if (el.dataset.tex) {
    return `$${el.dataset.tex}$`;
  }
  if (el.tagName.toLowerCase() === 'br') {
    return '';
  }
  return Array.from(el.childNodes).map(extractInlineText).join('');
}

function serializeEditorDom(root: HTMLElement): ArticleContentBlock[] {
  const blocks: ArticleContentBlock[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent?.trim();
      if (txt) blocks.push(txt);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (el.dataset.tex) {
      blocks.push(`$${el.dataset.tex}$`);
      return;
    }

    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'))
        .map((tr) =>
          Array.from(tr.querySelectorAll('th, td')).map(
            (cell) => extractInlineText(cell).trim(),
          ),
        )
        .filter((row) => row.length > 0);
      if (rows.length > 0) {
        blocks.push({ type: 'table', rows });
      }
      return;
    }

    if (tag === 'img') {
      const src = el.getAttribute('src')?.trim();
      if (src) {
        blocks.push({
          type: 'image',
          src,
          alt: el.getAttribute('alt')?.trim() || undefined,
        });
      }
      return;
    }

    if (tag === 'hr') {
      blocks.push({ type: 'divider' });
      return;
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const txt = extractInlineText(el).trim();
      if (txt) blocks.push({ type: 'heading', text: txt });
      return;
    }

    if (tag === 'blockquote') {
      const txt = extractInlineText(el).trim();
      if (txt) blocks.push({ type: 'quote', text: txt });
      return;
    }

    if (tag === 'p' || tag === 'div' || tag === 'li') {
      const imgs = el.querySelectorAll('img');
      if (imgs.length > 0) {
        Array.from(el.childNodes).forEach(walk);
        return;
      }
      const txt = extractInlineText(el).trim();
      if (txt) blocks.push(txt);
      return;
    }

    Array.from(el.childNodes).forEach(walk);
  }

  Array.from(root.childNodes).forEach(walk);
  return blocks;
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
  const [charCount, setCharCount] = useState(0);
  const [previewBlocks, setPreviewBlocks] = useState<ArticleContentBlock[]>([]);

  const [activePopover, setActivePopover] = useState<'table' | 'formula' | null>(null);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [formulaTex, setFormulaTex] = useState('');

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingInline, setUploadingInline] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedHtmlRef = useRef<string>('');
  const savedRangeRef = useRef<Range | null>(null);
  const editingFormulaElRef = useRef<HTMLElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const inlineImgInputRef = useRef<HTMLInputElement | null>(null);

  const readMinutes = Math.max(1, Math.ceil(charCount / 400));

  const formulaPreviewHtml = useMemo(() => {
    if (!formulaTex.trim()) return '';
    return katex.renderToString(formulaTex.trim(), {
      displayMode: true,
      throwOnError: false,
    });
  }, [formulaTex]);

  if (!user) {
    return (
      <div className="wx-editor-shell">
        <div className="wx-editor-topbar">
          <Link
            to="/category/renju"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.9rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
          >
            <ArrowLeft size={16} />
            返回资讯
          </Link>
        </div>
        <div
          className="wx-editor-paper"
          style={{ textAlign: 'center', padding: '48px 24px' }}
        >
          <h1 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>发布文章</h1>
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

  function syncEditorStats() {
    if (!editorRef.current) return;
    savedHtmlRef.current = editorRef.current.innerHTML;
    const text = editorRef.current.innerText.replace(/\s+/g, '');
    setCharCount(text.length);
  }

  function execFormat(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditorStats();
  }

  function insertDivider() {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, '<hr /><p><br /></p>');
    syncEditorStats();
  }

  function insertImageHtml(url: string) {
    editorRef.current?.focus();
    document.execCommand(
      'insertHTML',
      false,
      `<p><img src="${url}" alt="" /></p><p><br /></p>`,
    );
    syncEditorStats();
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (
      sel &&
      sel.rangeCount > 0 &&
      editorRef.current?.contains(sel.anchorNode)
    ) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  }

  function insertTableHtml() {
    const r = Math.min(12, Math.max(1, tableRows));
    const c = Math.min(8, Math.max(1, tableCols));
    const rowHtml = `<tr>${Array.from({ length: c }, () => '<td>内容</td>').join('')}</tr>`;
    const allRows = Array.from({ length: r }, () => rowHtml).join('');
    const html = `<table><tbody>${allRows}</tbody></table><p><br /></p>`;

    restoreSelection();
    document.execCommand('insertHTML', false, html);
    syncEditorStats();
    setActivePopover(null);
  }

  function insertFormulaHtml() {
    const tex = formulaTex.trim();
    if (!tex) return;
    const rendered = katex.renderToString(tex, {
      displayMode: false,
      throwOnError: false,
    });

    const targetEl = editingFormulaElRef.current;
    if (targetEl && editorRef.current?.contains(targetEl)) {
      targetEl.dataset.tex = tex;
      targetEl.innerHTML = rendered;
      syncEditorStats();
      editingFormulaElRef.current = null;
      setFormulaTex('');
      setActivePopover(null);
      return;
    }

    const escapedTex = tex.replace(/"/g, '&quot;');
    const html = `<span class="wx-inline-formula" data-tex="${escapedTex}" title="双击编辑公式" contenteditable="false">${rendered}</span>&nbsp;`;

    restoreSelection();
    document.execCommand('insertHTML', false, html);
    syncEditorStats();
    setFormulaTex('');
    setActivePopover(null);
  }

  function handleEditorDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    const formulaEl = (e.target as HTMLElement).closest(
      '.wx-inline-formula',
    ) as HTMLElement | null;
    if (!formulaEl || formulaEl.dataset.tex === undefined) return;
    e.preventDefault();
    editingFormulaElRef.current = formulaEl;
    setFormulaTex(formulaEl.dataset.tex);
    setActivePopover('formula');
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

  async function handleInlineFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setUploadingInline(true);
    setError(null);
    try {
      const url = await newsService.uploadArticleImage(user.id, file);
      insertImageHtml(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '图片上传失败');
    } finally {
      setUploadingInline(false);
    }
  }

  function togglePreview() {
    setActivePopover(null);
    if (mode === 'edit') {
      if (editorRef.current) {
        savedHtmlRef.current = editorRef.current.innerHTML;
        setPreviewBlocks(serializeEditorDom(editorRef.current));
      }
      setMode('preview');
    } else {
      setMode('edit');
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = savedHtmlRef.current;
        }
      });
    }
  }

  async function handlePublish() {
    if (!user || submitting) return;

    const cleanTitle = title.trim();
    const contentBlocks =
      mode === 'edit' && editorRef.current
        ? serializeEditorDom(editorRef.current)
        : previewBlocks;

    if (!cleanTitle) {
      setError('请输入文章标题');
      return;
    }
    if (contentBlocks.length === 0) {
      setError('请输入正文内容');
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

  const fieldStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
  } as const;

  const labelStyle = {
    display: 'block',
    fontSize: '0.82rem',
    fontWeight: 700,
    marginBottom: 6,
    color: 'var(--color-text-secondary)',
  } as const;

  return (
    <div className="wx-editor-shell">
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

      {/* 顶部固定工具栏 */}
      <header className="wx-editor-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link
            to="/category/renju"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.88rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
          >
            <ArrowLeft size={16} />
            返回资讯
          </Link>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {charCount} 字 · 约 {readMinutes} 分钟
          </span>
        </div>

        {mode === 'edit' ? (
          <div className="wx-editor-toolbar" role="toolbar" aria-label="文章排版工具栏">
            <button
              type="button"
              className="wx-toolbar-btn"
              onClick={() => execFormat('formatBlock', 'p')}
            >
              <Pilcrow size={14} />
              正文
            </button>
            <button
              type="button"
              className="wx-toolbar-btn"
              onClick={() => execFormat('formatBlock', 'h2')}
            >
              <Heading2 size={14} />
              小标题
            </button>
            <button
              type="button"
              className="wx-toolbar-btn"
              onClick={() => execFormat('bold')}
            >
              <Bold size={14} />
              加粗
            </button>
            <button
              type="button"
              className="wx-toolbar-btn"
              onClick={() => execFormat('italic')}
            >
              <Italic size={14} />
              斜体
            </button>
            <button
              type="button"
              className="wx-toolbar-btn"
              onClick={() => execFormat('formatBlock', 'blockquote')}
            >
              <Quote size={14} />
              引用
            </button>
            <button
              type="button"
              className="wx-toolbar-btn"
              onClick={() => execFormat('justifyLeft')}
              title="左对齐"
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              className="wx-toolbar-btn"
              onClick={() => execFormat('justifyCenter')}
              title="居中对齐"
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              className="wx-toolbar-btn"
              disabled={uploadingInline}
              onClick={() => inlineImgInputRef.current?.click()}
            >
              <ImagePlus size={14} />
              {uploadingInline ? '上传中...' : '图片'}
            </button>
            <button
              type="button"
              className="wx-toolbar-btn"
              onClick={() => {
                saveSelection();
                setActivePopover((prev) => (prev === 'table' ? null : 'table'));
              }}
            >
              <Table2 size={14} />
              表格
            </button>
            <button
              type="button"
              className="wx-toolbar-btn"
              onClick={() => {
                saveSelection();
                editingFormulaElRef.current = null;
                setFormulaTex('');
                setActivePopover((prev) => (prev === 'formula' ? null : 'formula'));
              }}
            >
              <Sigma size={14} />
              公式
            </button>
            <button
              type="button"
              className="wx-toolbar-btn"
              onClick={insertDivider}
            >
              <Minus size={14} />
              分割线
            </button>
          </div>
        ) : (
          <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            文章预览模式
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            每日首篇 +50 源点
          </span>
          <button
            type="button"
            className="category-pill"
            onClick={togglePreview}
            style={{
              padding: '6px 13px',
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Eye size={14} />
            {mode === 'edit' ? '预览' : '返回编辑'}
          </button>
          <button
            type="button"
            disabled={submitting}
            className="category-pill active"
            onClick={handlePublish}
            style={{ padding: '6px 18px', fontSize: '0.86rem' }}
          >
            {submitting ? '发布中...' : '发布文章'}
          </button>
        </div>

      </header>

      {/* 插入表格弹窗 */}
      {mode === 'edit' && activePopover === 'table' ? (
        <div
          className="wx-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="插入表格"
          onClick={() => setActivePopover(null)}
        >
          <div className="wx-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="wx-modal-header">
              <strong style={{ fontSize: '1.02rem' }}>插入表格</strong>
              <button
                type="button"
                aria-label="关闭弹窗"
                onClick={() => setActivePopover(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  padding: 4,
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div>
                <label htmlFor="tbl-rows" style={labelStyle}>
                  行数
                </label>
                <input
                  id="tbl-rows"
                  type="number"
                  min={1}
                  max={12}
                  value={tableRows}
                  onChange={(e) => setTableRows(Number(e.target.value) || 1)}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label htmlFor="tbl-cols" style={labelStyle}>
                  列数
                </label>
                <input
                  id="tbl-cols"
                  type="number"
                  min={1}
                  max={8}
                  value={tableCols}
                  onChange={(e) => setTableCols(Number(e.target.value) || 1)}
                  style={fieldStyle}
                />
              </div>
            </div>

            <div className="wx-modal-footer">
              <button
                type="button"
                className="category-pill"
                onClick={() => setActivePopover(null)}
                style={{ padding: '6px 14px', fontSize: '0.84rem' }}
              >
                取消
              </button>
              <button
                type="button"
                className="category-pill active"
                onClick={insertTableHtml}
                style={{ padding: '6px 16px', fontSize: '0.84rem' }}
              >
                插入表格
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 插入/编辑公式弹窗 */}
      {mode === 'edit' && activePopover === 'formula' ? (
        <div
          className="wx-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={editingFormulaElRef.current ? '编辑行内公式' : '插入行内公式'}
          onClick={() => {
            editingFormulaElRef.current = null;
            setActivePopover(null);
          }}
        >
          <div
            className="wx-modal-dialog"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wx-modal-header">
              <strong style={{ fontSize: '1.02rem' }}>
                {editingFormulaElRef.current ? '编辑行内公式' : '插入行内公式'}
              </strong>
              <button
                type="button"
                aria-label="关闭弹窗"
                onClick={() => {
                  editingFormulaElRef.current = null;
                  setActivePopover(null);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  padding: 4,
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label htmlFor="formula-input" style={labelStyle}>
                LaTeX 公式
              </label>
              <input
                id="formula-input"
                type="text"
                autoFocus
                value={formulaTex}
                onChange={(e) => setFormulaTex(e.target.value)}
                placeholder="请输入 LaTeX 公式..."
                style={fieldStyle}
              />
            </div>

            {formulaPreviewHtml ? (
              <div
                className="article-formula"
                style={{
                  margin: '14px 0 0',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-muted)',
                }}
                dangerouslySetInnerHTML={{ __html: formulaPreviewHtml }}
              />
            ) : null}

            <div className="wx-modal-footer">
              <button
                type="button"
                className="category-pill"
                onClick={() => {
                  editingFormulaElRef.current = null;
                  setActivePopover(null);
                }}
                style={{ padding: '6px 14px', fontSize: '0.84rem' }}
              >
                取消
              </button>
              <button
                type="button"
                className="category-pill active"
                onClick={insertFormulaHtml}
                disabled={!formulaTex.trim()}
                style={{ padding: '6px 16px', fontSize: '0.84rem' }}
              >
                {editingFormulaElRef.current ? '保存修改' : '插入公式'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 居中稿纸编辑区 */}
      <main className="wx-editor-paper">
        {error ? (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: '#fef2f2',
              color: '#dc2626',
              fontSize: '0.86rem',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        ) : null}

        {mode === 'preview' ? (
          <div>
            <div style={{ marginBottom: 10 }}>
              <Badge>{category === 'football' ? '足球' : '五子棋'}</Badge>
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: '1.75rem', lineHeight: 1.35 }}>
              {title.trim() || '（未填写标题）'}
            </h1>
            <div
              style={{
                fontSize: '0.84rem',
                color: 'var(--color-text-muted)',
                marginBottom: 20,
                paddingBottom: 14,
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
                      {renderTextWithMath(block)}
                    </p>
                  );
                }
                if (block.type === 'heading') {
                  return (
                    <h2
                      key={idx}
                      style={{ margin: '24px 0 12px', fontSize: '1.24rem', fontWeight: 700 }}
                    >
                      {renderTextWithMath(block.text)}
                    </h2>
                  );
                }
                if (block.type === 'quote') {
                  return (
                    <blockquote
                      key={idx}
                      style={{
                        margin: '18px 0',
                        padding: '10px 16px',
                        borderLeft: '3px solid var(--color-primary)',
                        background: 'var(--color-surface-muted)',
                        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {renderTextWithMath(block.text)}
                    </blockquote>
                  );
                }
                if (block.type === 'divider') {
                  return (
                    <hr
                      key={idx}
                      style={{
                        margin: '24px 0',
                        border: 'none',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    />
                  );
                }
                if (block.type === 'table') {
                  return (
                    <div key={idx} style={{ overflowX: 'auto' }}>
                      <table className="article-table">
                        <thead>
                          {block.rows[0] ? (
                            <tr>
                              {block.rows[0].map((cell, cIdx) => (
                                <th key={cIdx}>{renderTextWithMath(cell)}</th>
                              ))}
                            </tr>
                          ) : null}
                        </thead>
                        <tbody>
                          {block.rows.slice(1).map((row, rIdx) => (
                            <tr key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx}>{renderTextWithMath(cell)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }
                if (block.type === 'formula') {
                  const html = katex.renderToString(block.tex, {
                    displayMode: true,
                    throwOnError: false,
                  });
                  return (
                    <div
                      key={idx}
                      className="article-formula"
                      dangerouslySetInnerHTML={{ __html: html }}
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
          <>
            <input
              type="text"
              className="wx-editor-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入文章标题..."
              maxLength={120}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                paddingBottom: 16,
                marginBottom: 20,
                borderBottom: '1px solid var(--color-border)',
                fontSize: '0.84rem',
                color: 'var(--color-text-muted)',
              }}
            >
              <span>作者：{user.username}</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span>频道：</span>
                <button
                  type="button"
                  className={`category-pill ${category === 'renju' ? 'active' : ''}`}
                  onClick={() => setCategory('renju')}
                  style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                >
                  五子棋
                </button>
                <button
                  type="button"
                  className={`category-pill ${category === 'football' ? 'active' : ''}`}
                  onClick={() => setCategory('football')}
                  style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                >
                  足球
                </button>
              </div>
            </div>

            <div
              ref={editorRef}
              className="wx-editor-body"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="请输入正文内容..."
              onInput={syncEditorStats}
              onDoubleClick={handleEditorDoubleClick}
            />

            <div
              style={{
                marginTop: 28,
                paddingTop: 22,
                borderTop: '1px dashed var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div>
                <label style={labelStyle}>封面图（选填）</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="url"
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                    placeholder="请输入封面图链接..."
                    style={{ ...fieldStyle, flex: '1 1 240px' }}
                  />
                  <button
                    type="button"
                    className="category-pill"
                    disabled={uploadingCover}
                    onClick={() => coverInputRef.current?.click()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 14px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <Upload size={14} />
                    {uploadingCover ? '上传中...' : '上传封面'}
                  </button>
                  {coverImage ? (
                    <button
                      type="button"
                      className="category-pill"
                      onClick={() => setCoverImage('')}
                      style={{ padding: '6px 12px', fontSize: '0.82rem' }}
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
                      maxHeight: 180,
                      borderRadius: 'var(--radius-sm)',
                      objectFit: 'cover',
                    }}
                  />
                ) : null}
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
                  placeholder="请输入文章摘要..."
                  maxLength={200}
                  style={fieldStyle}
                />
              </div>

              <div>
                <label htmlFor="pub-tags" style={labelStyle}>
                  文章标签（选填，多个标签用逗号或空格分隔）
                </label>
                <input
                  id="pub-tags"
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="请输入文章标签..."
                  style={fieldStyle}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
