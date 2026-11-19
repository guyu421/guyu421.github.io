import type { SportCategoryId } from '@/types/common';
import type { MatchItem, MatchStatus, StandingRow } from '@/types/match';
import { apiRequest } from './apiClient';

export const matchService = {
  async getMatches(
    category: SportCategoryId = 'all',
    status?: MatchStatus,
  ): Promise<MatchItem[]> {
    const query = new URLSearchParams();
    if (category !== 'all') {
      query.set('category', category);
    }
    if (status) {
      query.set('status', status);
    }

    const qs = query.toString();
    return apiRequest<MatchItem[]>(`/api/matches${qs ? `?${qs}` : ''}`);
  },

  async getStandings(): Promise<StandingRow[]> {
    return apiRequest<StandingRow[]>('/api/standings');
  },
};
