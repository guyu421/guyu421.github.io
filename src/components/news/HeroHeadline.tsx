import { Link } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { CATEGORY_MAP } from '@/constants/categories';
import type { NewsArticle } from '@/types/news';
import { formatRelativeTime } from '@/utils/formatDate';

interface HeroHeadlineProps {
  article: NewsArticle;
}

export function HeroHeadline({ article }: HeroHeadlineProps) {
  const categoryMeta = CATEGORY_MAP[article.category];

  return (
    <Link to={`/article/${article.slug}`} className="hero-card">
      <img
        src={article.coverImage}
        alt={article.title}
        className="hero-bg"
      />
      <div className="hero-overlay">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {article.isBreaking ? <Badge variant="breaking">头条快讯</Badge> : null}
          <Badge color={categoryMeta?.accentColor}>{article.categoryLabel}</Badge>
          <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
            {formatRelativeTime(article.publishedAt)}
          </span>
        </div>
        <h1 className="hero-title">{article.title}</h1>
        <p className="hero-summary">{article.summary}</p>
      </div>
    </Link>
  );
}
