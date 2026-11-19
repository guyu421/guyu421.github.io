interface LoadingSkeletonProps {
  count?: number;
}

export function LoadingSkeleton({ count = 3 }: LoadingSkeletonProps) {
  return (
    <div className="news-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card" style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 150, marginBottom: 14 }} />
          <div className="skeleton" style={{ height: 18, width: '85%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 14, width: '60%' }} />
        </div>
      ))}
    </div>
  );
}
