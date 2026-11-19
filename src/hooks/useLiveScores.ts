import { useEffect, useState } from 'react';
import { matchService } from '@/services/matchService';
import type { AsyncState, SportCategoryId } from '@/types/common';
import type { MatchItem, MatchStatus } from '@/types/match';

export function useLiveScores(
  category: SportCategoryId = 'all',
  status?: MatchStatus,
): AsyncState<MatchItem[]> {
  const [state, setState] = useState<AsyncState<MatchItem[]>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    matchService
      .getMatches(category, status)
      .then((matches) => {
        if (!active) return;
        setState({ data: matches, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : '加载赛程失败';
        setState({ data: [], loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [category, status]);

  return state;
}
