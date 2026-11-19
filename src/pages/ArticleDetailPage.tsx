import { ArrowLeft, Bookmark, Clock, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { NewsList } from '@/components/news/NewsList';
import { CATEGORY_MAP } from '@/constants/categories';
import { newsService } from '@/services/newsService';
import { useAppStore } from '@/store/AppContext';
import type { NewsArticle } from '@/types/news';
import { formatRelativeTime } from '@/utils/formatDate';

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isBookmarked, toggleBookmark } = useAppStore();

  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [related, setRelated] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);

    newsService
      .getArticleBySlug(slug)
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
  }, [slug]);

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
          description="文章可能已下线或链接有误。"
        />
      </div>
    );
  }

  const categoryMeta = CATEGORY_MAP[article.category];
  const bookmarked = isBookmarked(article.id);

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
          borderBottom: '1px solid var(--color-border)',
          fontSize: '0.86rem',
          color: 'var(--color-text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <strong style={{ color: 'var(--color-text)' }}>{article.author.name}</strong>
          <span>{article.author.role}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={14} />
            {formatRelativeTime(article.publishedAt)}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Eye size={14} />
            {article.views.toLocaleString()}
          </span>
        </div>

        <button
          type="button"
          className="category-pill"
          onClick={() => toggleBookmark(article.id)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} />
          {bookmarked ? '已收藏' : '收藏'}
        </button>
      </div>

      <img
        src={article.coverImage}
        alt={article.title}
        className="article-cover"
      />

      <p
        style={{
          fontSize: '1.08rem',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          marginBottom: 20,
        }}
      >
        {article.summary}
      </p>

      <div>
        {article.content.map((paragraph, idx) => (
          <p key={idx} className="article-paragraph">
            {paragraph}
          </p>
        ))}
      </div>

      {related.length > 0 ? (
        <section style={{ marginTop: 42 }}>
          <div className="section-header">
            <h2 className="section-title">相关推荐</h2>
          </div>
          <NewsList articles={related} />
        </section>
      ) : null}
    </div>
  );
}
