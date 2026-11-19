import { ArrowLeft, Clock, ExternalLink, Trash2 } from 'lucide-react';
import katex from 'katex';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AccountComments } from '@/components/common/AccountComments';
import { Badge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { NewsList } from '@/components/news/NewsList';
import { CATEGORY_MAP } from '@/constants/categories';
import { newsService } from '@/services/newsService';
import { useAuth } from '@/store/AuthContext';
import type { NewsArticle } from '@/types/news';
import { formatRelativeTime } from '@/utils/formatDate';
import { renderTextWithMath } from '@/utils/math';

export function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [related, setRelated] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);

    newsService
      .getArticleById(id)
      .then(async (data) => {
        if (!active) return;
        setArticle(data);
        if (data) {
          const relatedItems = await newsService.getRelatedArticles(
            data.id,
            data.category,
            3,
          );
          if (active) setRelated(relatedItems);
        }
        if (active) setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="container article-container">
        <LoadingSkeleton count={1} />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container article-container">
        <EmptyState
          title="未找到该篇资讯"
          description="文章可能已下线或编号有误。"
        />
      </div>
    );
  }

  const categoryMeta = CATEGORY_MAP[article.category];
  const isOwner = Boolean(user && article.userId && user.id === article.userId);

  async function handleDelete() {
    if (!article || !isOwner || deleting) return;
    if (!window.confirm('确定要删除这篇文章吗？删除后无法恢复。')) return;
    setDeleting(true);
    try {
      await newsService.deleteArticle(article.id);
      navigate(`/category/${article.category}`, { replace: true });
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="container article-container">
      <Link
        to={`/category/${article.category}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.9rem',
          color: 'var(--color-text-secondary)',
          marginBottom: 18,
          fontWeight: 600,
        }}
      >
        <ArrowLeft size={16} />
        返回{article.categoryLabel}频道
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Badge color={categoryMeta?.accentColor}>{article.categoryLabel}</Badge>
        {article.isBreaking ? <Badge variant="breaking">快讯</Badge> : null}
      </div>

      <h1 style={{ margin: '0 0 14px', fontSize: '1.9rem', lineHeight: 1.3 }}>
        {article.title}
      </h1>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 16,
          marginBottom: 20,
          borderBottom: '1px solid var(--color-border)',
          fontSize: '0.86rem',
          color: 'var(--color-text-muted)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
          <strong style={{ color: 'var(--color-text)' }}>{article.author.name}</strong>
          <span>{article.author.role}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={14} />
            {formatRelativeTime(article.publishedAt)}
          </span>
          {article.sourceUrl ? (
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--color-primary)',
                fontWeight: 600,
              }}
            >
              查看公众号原文
              <ExternalLink size={13} />
            </a>
          ) : null}
        </div>

        {isOwner ? (
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#dc2626',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} />
            {deleting ? '删除中...' : '删除文章'}
          </button>
        ) : null}
      </div>

      {article.coverImage ? (
        <img
          src={article.coverImage}
          alt={article.title}
          className="article-cover"
          referrerPolicy="no-referrer"
        />
      ) : null}

      <div>
        {article.content.map((block, idx) => {
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
                style={{
                  margin: '24px 0 12px',
                  fontSize: '1.24rem',
                  fontWeight: 700,
                  lineHeight: 1.4,
                }}
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
                  lineHeight: 1.7,
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
              <figure key={idx} style={{ margin: '20px 0' }}>
                <img
                  src={block.src}
                  alt={block.alt || article.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-md)',
                    display: 'block',
                  }}
                />
              </figure>
            );
          }
          return (
            <p key={idx} className="article-paragraph">
              {renderTextWithMath(block.text)}
            </p>
          );
        })}
      </div>

      {related.length > 0 ? (
        <section style={{ marginTop: 42 }}>
          <div className="section-header">
            <h2 className="section-title">相关推荐</h2>
          </div>
          <NewsList articles={related} />
        </section>
      ) : null}

      <AccountComments articleId={article.id} />
    </div>
  );
}
