import { Calendar, ChevronRight, MapPin, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { matchService } from '@/services/matchService';
import type { RenjuMatchStatus, TournamentItem } from '@/types/match';

const STATUS_LABEL: Record<RenjuMatchStatus, string> = {
  live: '进行中',
  upcoming: '未开赛',
  finished: '已完赛',
};

export function MatchesPage() {
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    matchService
      .getTournaments()
      .then((data) => {
        if (active) setTournaments(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : '加载赛事列表失败');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="container">
      <div className="section-header" style={{ marginBottom: 18 }}>
        <h1 className="section-title" style={{ fontSize: '1.5rem' }}>
          赛事列表
        </h1>
        <span style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>
          共 {tournaments.length} 项赛事
        </span>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 24 }}>
          <div className="skeleton" style={{ height: 96 }} />
        </div>
      ) : error ? (
        <EmptyState title="赛事列表加载失败" description={error} />
      ) : tournaments.length === 0 ? (
        <EmptyState
          title="暂无赛事"
          description="请先在 Supabase 执行 schema.sql 初始化赛事数据。"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tournaments.map((item) => (
            <Link
              key={item.id}
              to={`/matches/${item.id}`}
              className="card"
              style={{
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Trophy size={16} color="#d97706" aria-hidden="true" />
                  <Badge>{item.groupName}</Badge>
                </div>
                <Badge variant={item.status === 'live' ? 'breaking' : 'neutral'}>
                  {STATUS_LABEL[item.status]}
                </Badge>
              </div>

              <h2 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, lineHeight: 1.4 }}>
                {item.title}
              </h2>

              {item.summary ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.88rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {item.summary}
                </p>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--color-surface-muted)',
                  fontSize: '0.82rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  {item.location ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} aria-hidden="true" />
                      {item.location}
                    </span>
                  ) : null}
                  {item.dateRange ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} aria-hidden="true" />
                      {item.dateRange}
                    </span>
                  ) : null}
                </div>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--color-primary)',
                    fontWeight: 700,
                  }}
                >
                  进入查看对局
                  <ChevronRight size={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
