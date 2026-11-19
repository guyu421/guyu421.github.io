import type { MatchItem } from '@/types/match';

interface LiveScoreTickerProps {
  matches: MatchItem[];
  loading?: boolean;
}

export function LiveScoreTicker({ matches, loading = false }: LiveScoreTickerProps) {
  if (loading) {
    return (
      <div className="ticker-strip">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ticker-card">
            <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 18, marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 18 }} />
          </div>
        ))}
      </div>
    );
  }

  if (matches.length === 0) return null;

  return (
    <section aria-label="即时比分条" className="ticker-strip">
      {matches.slice(0, 4).map((match) => (
        <div key={match.id} className="ticker-card">
          <div className="ticker-meta">
            <span>{match.league}</span>
            {match.status === 'live' ? (
              <span className="ticker-status-live">
                <span className="live-pulse" aria-hidden="true" />
                {match.statusText}
              </span>
            ) : (
              <span>{match.statusText}</span>
            )}
          </div>

          <div className="ticker-row">
            <span>{match.homeTeam.shortName}</span>
            <span className="tabular-nums">
              {match.homeTeam.score !== null ? match.homeTeam.score : '-'}
            </span>
          </div>
          <div className="ticker-row">
            <span>{match.awayTeam.shortName}</span>
            <span className="tabular-nums">
              {match.awayTeam.score !== null ? match.awayTeam.score : '-'}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
