import { MapPin } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import type { MatchItem } from '@/types/match';
import { formatMatchTime } from '@/utils/formatDate';

interface MatchCardProps {
  match: MatchItem;
}

export function MatchCard({ match }: MatchCardProps) {
  const isLive = match.status === 'live';

  return (
    <div className="card" style={{ padding: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          fontSize: '0.82rem',
          color: 'var(--color-text-muted)',
        }}
      >
        <span style={{ fontWeight: 600 }}>{match.league}</span>
        {isLive ? (
          <Badge variant="breaking">{match.statusText}</Badge>
        ) : (
          <Badge>{match.statusText}</Badge>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}>
          {match.homeTeam.name}
        </div>

        <div
          className="tabular-nums"
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface-muted)',
            fontWeight: 800,
            fontSize: '1.15rem',
          }}
        >
          {match.homeTeam.score !== null && match.awayTeam.score !== null
            ? `${match.homeTeam.score} : ${match.awayTeam.score}`
            : 'VS'}
        </div>

        <div style={{ textAlign: 'left', fontWeight: 700, fontSize: '1rem' }}>
          {match.awayTeam.name}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          color: 'var(--color-text-muted)',
          borderTop: '1px solid var(--color-surface-muted)',
          paddingTop: 10,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={13} aria-hidden="true" />
          {match.venue}
        </span>
        <span>{formatMatchTime(match.startTime)}</span>
      </div>
    </div>
  );
}
