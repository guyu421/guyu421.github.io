import { requireSupabase } from '@/lib/supabase';
import type { RenjuMatch, RenjuMatchStatus, TournamentItem } from '@/types/match';

interface TournamentRow {
  id: number;
  title: string;
  group_name: string;
  location: string;
  date_range: string;
  status: RenjuMatchStatus;
  summary: string;
}

interface RenjuMatchRow {
  id: number;
  tournament_id: number | null;
  tournament: string;
  group_name: string;
  round_name: string;
  board_no: number;
  status: RenjuMatchStatus;
  black_no: number | null;
  black_player: string;
  black_rating: number | null;
  white_no: number | null;
  white_player: string;
  white_rating: number | null;
  black_score: number | null;
  white_score: number | null;
  result_text: string;
  opening: string | null;
  moves_count: number | null;
  moves: string[] | null;
  played_at: string;
}

function mapTournament(row: TournamentRow): TournamentItem {
  return {
    id: row.id,
    title: row.title,
    groupName: row.group_name,
    location: row.location,
    dateRange: row.date_range,
    status: row.status,
    summary: row.summary,
  };
}

function mapMatch(row: RenjuMatchRow): RenjuMatch {
  return {
    id: row.id,
    tournamentId: row.tournament_id ?? 1,
    tournament: row.tournament,
    groupName: row.group_name,
    roundName: row.round_name,
    boardNo: row.board_no,
    status: row.status,
    blackNo: row.black_no ?? undefined,
    blackPlayer: row.black_player,
    blackRating: row.black_rating ?? undefined,
    whiteNo: row.white_no ?? undefined,
    whitePlayer: row.white_player,
    whiteRating: row.white_rating ?? undefined,
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
  async getTournaments(): Promise<TournamentItem[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as TournamentRow[]).map(mapTournament);
  },

  async getTournamentById(tournamentId: number): Promise<TournamentItem | null> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapTournament(data as TournamentRow) : null;
  },

  async getMatchesByTournament(
    tournamentId: number,
    status?: RenjuMatchStatus,
  ): Promise<RenjuMatch[]> {
    const supabase = requireSupabase();
    let query = supabase
      .from('renju_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
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
