import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { NewsList } from '@/components/news/NewsList';
import { useDebounce } from '@/hooks/useDebounce';
import { useNewsFeed } from '@/hooks/useNewsFeed';
import { matchService } from '@/services/matchService';
import { useAppStore } from '@/store/AppContext';
import type { TournamentItem } from '@/types/match';

export function UnifiedSearchResults() {
  const { activeCategory, searchQuery, setSearchQuery } = useAppStore();
  const debouncedSearch = useDebounce(searchQuery, 250);
  const q = debouncedSearch.trim().toLowerCase();

  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [tLoading, setTLoading] = useState(true);
  const [matchedTeams, setMatchedTeams] = useState<
    Array<{ name: string; logoUrl?: string }>
  >([]);
  const [matchedPlayers, setMatchedPlayers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [pLoading, setPLoading] = useState(false);

  useEffect(() => {
    let active = true;
    matchService
      .getTournaments()
      .then((data) => {
        if (active) setTournaments(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setTLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const matchedTournaments = useMemo(() => {
    if (!q) return [];
    return tournaments.filter((t) => {
      if (activeCategory !== 'all' && t.sport !== activeCategory) return false;
      return t.name.toLowerCase().includes(q);
    });
  }, [tournaments, q, activeCategory]);

  useEffect(() => {
    let active = true;
    if (!q) {
      setMatchedTeams([]);
      setMatchedPlayers([]);
      setPLoading(false);
      return;
    }
    setPLoading(true);
    matchService
      .searchParticipants(q)
      .then((res) => {
        if (!active) return;
        setMatchedTeams(activeCategory === 'renju' ? [] : res.teams);
        setMatchedPlayers(activeCategory === 'football' ? [] : res.players);
      })
      .catch(() => {
        if (active) {
          setMatchedTeams([]);
          setMatchedPlayers([]);
        }
      })
      .finally(() => {
        if (active) setPLoading(false);
      });
    return () => {
      active = false;
    };
  }, [q, activeCategory]);

  const newsState = useNewsFeed({
    category: activeCategory,
    search: debouncedSearch,
  });

  const isLoading = tLoading || pLoading || newsState.loading;
  const totalCount =
    matchedTeams.length +
    matchedPlayers.length +
    matchedTournaments.length +
    newsState.data.length;

  return (
    <div className="container">
      <div className="section-header">
        <h1 className="section-title" style={{ fontSize: '1.35rem' }}>
          搜索结果
        </h1>
        <span style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
          {isLoading ? '搜索中...' : `共 ${totalCount} 项结果`}
        </span>
      </div>

      {isLoading ? (
        <div className="card" style={{ padding: 24 }}>
          <div className="skeleton" style={{ height: 96 }} />
        </div>
      ) : totalCount === 0 ? (
        <EmptyState
          title="未找到相关内容"
          description="没有匹配该关键词的赛事或文章，请尝试更换其他关键词。"
        />
      ) : (
        <>
          {matchedTeams.length > 0 ? (
            <section style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 8,
                }}
              >
                足球（{matchedTeams.length}）
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="fixture-list">
                  {matchedTeams.map((team) => (
                    <Link
                      key={team.name}
                      to={`/team/${encodeURIComponent(team.name)}`}
                      onClick={() => setSearchQuery('')}
                      className="fixture-row fixture-link"
                      style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}
                    >
                      <div className="fixture-players">
                        <div className="fixture-player-line">
                          {team.logoUrl ? (
                            <img
                              className="team-logo"
                              src={team.logoUrl}
                              alt=""
                              loading="lazy"
                            />
                          ) : null}
                          <span>{team.name}</span>
                        </div>
                      </div>
                      <div className="fixture-scores">
                        <ChevronRight size={18} color="var(--color-text-muted)" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {matchedPlayers.length > 0 ? (
            <section style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 8,
                }}
              >
                五子棋（{matchedPlayers.length}）
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="fixture-list">
                  {matchedPlayers.map((player) => (
                    <Link
                      key={player.id}
                      to={`/player/${encodeURIComponent(player.id)}`}
                      onClick={() => setSearchQuery('')}
                      className="fixture-row fixture-link"
                      style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}
                    >
                      <div className="fixture-players">
                        <div className="fixture-player-line">
                          <span>{player.name}</span>
                        </div>
                      </div>
                      <div className="fixture-scores">
                        <ChevronRight size={18} color="var(--color-text-muted)" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {matchedTournaments.length > 0 ? (
            <section style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 8,
                }}
              >
                赛事（{matchedTournaments.length}）
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="fixture-list">
                  {matchedTournaments.map((item) => (
                    <Link
                      key={item.id}
                      to={`/matches/${item.id}`}
                      onClick={() => setSearchQuery('')}
                      className="fixture-row"
                      style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}
                    >
                      <div className="fixture-players">
                        <div
                          className="fixture-player-line"
                          style={{ whiteSpace: 'normal' }}
                        >
                          {item.logoUrl ? (
                            <img
                              className="league-logo"
                              src={item.logoUrl}
                              alt=""
                              loading="lazy"
                            />
                          ) : null}
                          <span>{item.name}</span>
                        </div>
                      </div>
                      <div className="fixture-scores">
                        <ChevronRight size={18} color="var(--color-text-muted)" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {newsState.data.length > 0 ? (
            <section>
              <div
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 8,
                }}
              >
                文章（{newsState.data.length}）
              </div>
              <NewsList
                articles={newsState.data}
                loading={false}
                error={newsState.error}
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
