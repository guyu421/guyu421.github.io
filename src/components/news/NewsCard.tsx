import { Bookmark, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { CATEGORY_MAP } from '@/constants/categories';
import { useAppStore } from '@/store/AppContext';
import type { NewsArticle } from '@/types/news';
import { formatRelativeTime } from '@/utils/formatDate';

interface NewsCardProps {
  article: NewsArticle;
}

export function NewsCard({ article }: NewsCardProps) {
  const { isBookmarked, toggleBookmark } = useAppStore();
  const bookmarked = isBookmarked(article.id);
  const categoryMeta = CATEGORY_MAP[article.category];

  return (
    <article className="card news-card">
      {article.coverImage ? (
        <Link to={`/article/${article.slug}`}>
          <img
            src={article.coverImage}
            alt={article.title}
            className="news-card-cover"
            loading="lazy"
          />
        </Link>
      ) : null}

      <div className="news-card-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Badge color={categoryMeta?.accentColor}>{article.categoryLabel}</Badge>
            {article.isBreaking ? <Badge variant="breaking">快讯</Badge> : null}
          </div>

          <button
            type="button"
            onClick={() => toggleBookmark(article.id)}
            aria-label={bookmarked ? '取消收藏' : '收藏文章'}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 4,
              color: bookmarked ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
          >
            <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>

        <Link to={`/article/${article.slug}`}>
          <h3 className="news-card-title">{article.title}</h3>
        </Link>

        <p className="news-card-summary">{article.summary}</p>

        <div className="news-card-footer">
          <span>{article.author.name}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={13} aria-hidden="true" />
            {formatRelativeTime(article.publishedAt)}
          </span>
        </div>
      </div>
    </article>
  );
}
