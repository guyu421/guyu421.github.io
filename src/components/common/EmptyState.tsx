interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div
      className="card"
      style={{
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>{title}</p>
      {description ? (
        <p style={{ margin: '8px 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
