import { ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { matchService } from '@/services/matchService';
import type { RenjuMatch, RenjuMatchStatus } from '@/types/match';
import { cn } from '@/utils/cn';
import { formatMatchTime } from '@/utils/formatDate';

const STATUS_TABS: Array<{ id: RenjuMatchStatus | 'all'; label: string }> = [
  { id: 'all', label: '全部对局' },
  { id: 'finished', label: '已完赛' },
  { id: 'live', label: '进行中' },
  { id: 'upcoming', label: '未开赛' },
];

const STATUS_LABEL: Record<RenjuMatchStatus, string> = {
  live: '进行中',
  upcoming: '未开赛',
  finished: '已完赛',
};

export function MatchesPage() {
  const [statusFilter, setStatusFilter] = useState<RenjuMatchStatus | 'all'>('all');
  const [matches, setMatches] = useState<RenjuMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    matchService
      .getMatches(statusFilter === 'all' ? undefined : statusFilter)
      .then((data) => {
        if (active) setMatches(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : '加载赛事失败');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [statusFilter]);

  return (
    <div className="container">
      <div
        className="card"
        style={{
          padding: '18px 20px',
          marginBottom: 20,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Trophy size={18} color="#f59e0b" aria-hidden="true" />
          <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>
            公开组棋谱（1-8台）
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
          “山海杯”2026年全国五子棋业余棋王争霸赛线下总决赛
        </h1>
      </div>

      <div
        className="section-header"
        style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}
      >
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn('category-pill', statusFilter === tab.id && 'active')}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
          共 {matches.length} 场
        </span>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 24 }}>
          <div className="skeleton" style={{ height: 84 }} />
        </div>
      ) : error ? (
        <EmptyState title="赛事加载失败" description={error} />
      ) : matches.length === 0 ? (
        <EmptyState
          title="暂无公开组棋谱数据"
          description="公众号附件1为微信小程序（图文管家）文件，导入 Supabase 的 renju_matches 表后将在此按主流体育赛事卡片形式展示每台对局。"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {matches.map((match) => {
            const expanded = expandedId === match.id;
            const hasScore =
              match.blackScore !== null && match.whiteScore !== null;

            return (
              <div key={match.id} className="match-score-card">
                <div className="match-score-header">
                  <span>
                    {match.groupName} · {match.roundName} · 第 {match.boardNo} 台
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {match.opening ? <Badge>{match.opening}</Badge> : null}
                    <Badge variant={match.status === 'live' ? 'breaking' : 'neutral'}>
                      {STATUS_LABEL[match.status]}
                    </Badge>
                  </div>
                </div>

                <div className="match-score-body">
                  <div className="match-player home">
                    <span>{match.blackPlayer}</span>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: '#0f172a',
                        color: '#ffffff',
                        flexShrink: 0,
                      }}
                    >
                      假先
                    </span>
                  </div>

                  <div className="score-pill tabular-nums">
                    {hasScore
                      ? `${match.blackScore} : ${match.whiteScore}`
                      : 'VS'}
                  </div>

                  <div className="match-player">
                    <span
                      className="badge"
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        flexShrink: 0,
                      }}
                    >
                      假后
                    </span>
                    <span>{match.whitePlayer}</span>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid var(--color-surface-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <span>
                    {match.resultText}
                    {match.movesCount > 0 ? ` · 共 ${match.movesCount} 手` : ''}
                    {' · '}
                    {formatMatchTime(match.playedAt)}
                  </span>

                  {match.moves.length > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(expanded ? null : match.id)
                      }
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-primary)',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.8rem',
                      }}
                    >
                      {expanded ? '收起棋谱' : '查看棋谱'}
                      {expanded ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  ) : null}
                </div>

                {expanded && match.moves.length > 0 ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-surface-muted)',
                      fontSize: '0.82rem',
                      lineHeight: 1.7,
                      fontFamily: 'monospace',
                      wordBreak: 'break-word',
                    }}
                  >
                    {match.moves.map((move, idx) => (
                      <span key={idx} style={{ marginRight: 8 }}>
                        {idx + 1}.{move}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
