import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import type { NewsArticle } from '@/types/news';
import { NewsCard } from './NewsCard';

interface NewsListProps {
  articles: NewsArticle[];
  loading?: boolean;
  error?: string | null;
}

export function NewsList({ articles, loading = false, error = null }: NewsListProps) {
  if (loading) {
    return <LoadingSkeleton count={4} />;
  }

  if (error) {
    return <EmptyState title="资讯加载失败" description={error} />;
  }

  if (articles.length === 0) {
    return (
      <EmptyState
        title="暂无匹配的体育资讯"
        description="尝试切换其他项目分类，或更换搜索关键词。"
      />
    );
  }

  return (
    <div className="news-grid">
      {articles.map((article) => (
        <NewsCard key={article.id} article={article} />
      ))}
    </div>
  );
}
