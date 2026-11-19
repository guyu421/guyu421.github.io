import { MessageSquare } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface GitHubCommentsProps {
  issueTerm: string;
  title?: string;
}

const GITHUB_REPO = 'guyu421/guyu421.github.io';

export function GitHubComments({
  issueTerm,
  title = '棋友评价与讨论',
}: GitHubCommentsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://utteranc.es/client.js';
    script.async = true;
    script.setAttribute('repo', GITHUB_REPO);
    script.setAttribute('issue-term', issueTerm);
    script.setAttribute('label', 'comments');
    script.setAttribute('theme', 'github-light');
    script.setAttribute('crossorigin', 'anonymous');

    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [issueTerm]);

  return (
    <section
      className="card"
      style={{ marginTop: 36, padding: 24 }}
      aria-label="GitHub 评价区"
    >
      <div
        className="section-header"
        style={{
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: '1px solid var(--color-border)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h2
          className="section-title"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <MessageSquare size={18} aria-hidden="true" />
          {title}
        </h2>
        <a
          href={`https://github.com/${GITHUB_REPO}/issues`}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: '0.82rem',
            color: 'var(--color-text-muted)',
          }}
        >
          由 GitHub Issues 驱动 · 查看全部讨论 →
        </a>
      </div>

      <div ref={containerRef} />
    </section>
  );
}
