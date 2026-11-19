export type RenjuMatchStatus = 'live' | 'upcoming' | 'finished';

export interface TournamentItem {
  id: number;
  title: string;
  groupName: string;
  location: string;
  dateRange: string;
  status: RenjuMatchStatus;
  summary: string;
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
  result: string | null;
}

export interface UserProfile {
  userId: string;
  username: string;
  sourcePoints: number;
  streakDays: number;
  lastCheckinDate: string | null;
}

export interface CheckInResult {
  alreadyCheckedIn: boolean;
  pointsEarned: number;
  sourcePoints: number;
  streakDays: number;
  checkinDate: string;
}
