import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="container" style={{ textAlign: 'center', padding: '64px 20px' }}>
      <h1 style={{ fontSize: '2.5rem', margin: '0 0 8px' }}>404</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>
        抱歉，您访问的页面不存在。
      </p>
      <Link to="/category/football" className="category-pill active" style={{ display: 'inline-block' }}>
        返回足球频道
      </Link>
    </div>
  );
}
