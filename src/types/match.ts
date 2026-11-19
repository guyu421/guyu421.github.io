export interface TournamentItem {
  id: number;
  name: string;
  dateRange: string;
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
  blackName: string;
  whiteId: string;
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
