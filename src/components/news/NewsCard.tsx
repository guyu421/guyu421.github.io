import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { CATEGORY_MAP } from '@/constants/categories';
import type { NewsArticle } from '@/types/news';
import { formatRelativeTime } from '@/utils/formatDate';

interface NewsCardProps {
  article: NewsArticle;
}

export function NewsCard({ article }: NewsCardProps) {
  const categoryMeta = CATEGORY_MAP[article.category];

  return (
    <article className="card news-card">
      {article.coverImage ? (
        <Link to={`/article/${article.id}`}>
          <img
            src={article.coverImage}
            alt={article.title}
            className="news-card-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </Link>
      ) : null}

      <div className="news-card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge color={categoryMeta?.accentColor}>{article.categoryLabel}</Badge>
          {article.isBreaking ? <Badge variant="breaking">快讯</Badge> : null}
        </div>

        <Link to={`/article/${article.id}`}>
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
