import { requireSupabase } from '@/lib/supabase';
import type { RenjuMatch, RenjuMatchStatus } from '@/types/match';

interface RenjuMatchRow {
  id: number;
  tournament: string;
  group_name: string;
  round_name: string;
  board_no: number;
  status: RenjuMatchStatus;
  black_player: string;
  white_player: string;
  black_score: number | null;
  white_score: number | null;
  result_text: string;
  opening: string | null;
  moves_count: number | null;
  moves: string[] | null;
  played_at: string;
}

function mapMatch(row: RenjuMatchRow): RenjuMatch {
  return {
    id: row.id,
    tournament: row.tournament,
    groupName: row.group_name,
    roundName: row.round_name,
    boardNo: row.board_no,
    status: row.status,
    blackPlayer: row.black_player,
    whitePlayer: row.white_player,
    blackScore: row.black_score,
    whiteScore: row.white_score,
    resultText: row.result_text,
    opening: row.opening ?? undefined,
    movesCount: row.moves_count ?? 0,
    moves: Array.isArray(row.moves) ? row.moves : [],
    playedAt: row.played_at,
  };
}

export const matchService = {
  async getMatches(status?: RenjuMatchStatus): Promise<RenjuMatch[]> {
    const supabase = requireSupabase();
    let query = supabase
      .from('renju_matches')
      .select('*')
      .order('round_name', { ascending: true })
      .order('board_no', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return (data as RenjuMatchRow[]).map(mapMatch);
  },
};
