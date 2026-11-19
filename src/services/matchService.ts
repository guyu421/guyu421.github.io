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
  tournament_id: number;
  round_no: number;
  board_no: number;
  match_date: string;
  status: RenjuMatchStatus;
  black_id: string;
  black_name: string;
  white_id: string;
  white_name: string;
  result: string | null;
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
    tournamentId: row.tournament_id,
    roundNo: row.round_no,
    boardNo: row.board_no,
    matchDate: row.match_date,
    status: row.status,
    blackId: row.black_id,
    blackName: row.black_name,
    whiteId: row.white_id,
    whiteName: row.white_name,
    result: row.result,
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

  async getMatchesByTournament(tournamentId: number): Promise<RenjuMatch[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('renju_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_no', { ascending: true })
      .order('board_no', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data as RenjuMatchRow[]).map(mapMatch);
  },
};
