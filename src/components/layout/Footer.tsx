export function Footer() {
  return (
    <footer className="site-footer">
      <div
        className="container"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span>© {new Date().getFullYear()} 赛源网</span>
      </div>
    </footer>
  );
}
