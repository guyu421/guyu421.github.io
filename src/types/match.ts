export type TiebreakerKey = 'buchholz' | 'median_buchholz' | 'wins';

export interface TournamentItem {
  id: number;
  name: string;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  tiebreakers: TiebreakerKey[];
  qualifyCount: number | null;
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
