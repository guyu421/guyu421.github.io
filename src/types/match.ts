export type TiebreakerKey =
  | 'buchholz'
  | 'median_buchholz'
  | 'progressive_buchholz'
  | 'wins'
  | 'direct_encounter'
  | 'h2h_points'
  | 'h2h_gd'
  | 'h2h_gf'
  | 'gd'
  | 'gf';
export type TournamentSport = 'renju' | 'football';

export interface StandingsZone {
  fromRank: number;
  toRank: number;
  bgColor?: string;
  cutoffLabel?: string;
  cutoffBefore?: boolean;
  cutoffColor?: string;
  cutoffLineColor?: string;
}

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
  logoUrl?: string;
  standingsZones: StandingsZone[];
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

export interface RenjuBracketMatch {
  id: number;
  tournamentId: number;
  stageRound: number;
  matchOrder: number;
  bracketType: 'main' | 'third_place';
  roundLabel: string;
  matchTime: string;
  player1Name: string;
  player1Seed?: number;
  player1Score: string;
  player2Name: string;
  player2Seed?: number;
  player2Score: string;
  winnerSlot: 1 | 2;
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
  lastArticleRewardDate: string | null;
}

export interface CheckInResult {
  alreadyCheckedIn: boolean;
  pointsEarned: number;
  sourcePoints: number;
  streakDays: number;
  checkinDate: string;
}
