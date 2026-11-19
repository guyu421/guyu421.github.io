export type TiebreakerKey = 'buchholz' | 'median_buchholz' | 'wins';
export type TournamentSport = 'renju' | 'football';

export interface TournamentItem {
  id: number;
  name: string;
  sport: TournamentSport;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  tiebreakers: TiebreakerKey[];
  qualifyCount: number | null;
  qualifyLabel: string;
  totalRounds: number;
  rulesText: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
}

export interface RenjuMatch {
  id: number;
  tournamentId: number;
  roundNo: number;
  boardNo: number;
  blackId: string;
  blackNo?: number;
  blackName: string;
  whiteId: string;
  whiteNo?: number;
  whiteName: string;
  matchTime: string;
  result: string | null;
}

export interface FootballMatch {
  id: number;
  tournamentId: number;
  roundNo: number;
  matchTime: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface FootballStanding {
  rank: number;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface UserProfile {
  userId: string;
  username: string;
  sourcePoints: number;
  streakDays: number;
  lastCheckinDate: string | null;
  lastCommentRewardDate: string | null;
}

export interface CheckInResult {
  alreadyCheckedIn: boolean;
  pointsEarned: number;
  sourcePoints: number;
  streakDays: number;
  checkinDate: string;
}
