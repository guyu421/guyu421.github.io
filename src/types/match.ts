import type { SportCategoryId } from './common';

export type MatchStatus = 'live' | 'upcoming' | 'finished';

export interface MatchTeam {
  id: string;
  name: string;
  shortName: string;
  score: number | null;
  badgeColor: string;
}

export interface MatchItem {
  id: string;
  league: string;
  category: Exclude<SportCategoryId, 'all'>;
  status: MatchStatus;
  statusText: string;
  startTime: string;
  venue: string;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
}

export interface StandingRow {
  rank: number;
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}
