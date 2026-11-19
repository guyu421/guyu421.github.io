export type RenjuMatchStatus = 'live' | 'upcoming' | 'finished';

export interface RenjuMatch {
  id: number;
  tournament: string;
  groupName: string;
  roundName: string;
  boardNo: number;
  status: RenjuMatchStatus;
  blackPlayer: string;
  whitePlayer: string;
  blackScore: number | null;
  whiteScore: number | null;
  resultText: string;
  opening?: string;
  movesCount: number;
  moves: string[];
  playedAt: string;
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
