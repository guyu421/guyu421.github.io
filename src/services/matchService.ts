import { requireSupabase } from '@/lib/supabase';
import type { PlayerInfo, RenjuMatch, TournamentItem } from '@/types/match';

interface TournamentRow {
  id: number;
  name: string;
}

interface RenjuMatchRow {
  id: number;
  tournament_id: number;
  round_no: number;
  board_no: number;
  black_id: string;
  white_id: string;
  match_time: string;
  result: string | null;
  black: PlayerInfo | PlayerInfo[] | null;
  white: PlayerInfo | PlayerInfo[] | null;
}

function unwrapPlayer(p: PlayerInfo | PlayerInfo[] | null, fallbackId: string): string {
  if (!p) return fallbackId;
  if (Array.isArray(p)) return p[0]?.name ?? fallbackId;
  return p.name ?? fallbackId;
}

function mapTournament(row: TournamentRow): TournamentItem {
  return {
    id: row.id,
    name: row.name,
  };
}

function mapMatch(row: RenjuMatchRow): RenjuMatch {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    roundNo: row.round_no,
    boardNo: row.board_no,
    blackId: row.black_id,
    blackName: unwrapPlayer(row.black, row.black_id),
    whiteId: row.white_id,
    whiteName: unwrapPlayer(row.white, row.white_id),
    matchTime: row.match_time,
    result: row.result,
  };
}

export const matchService = {
  async getTournaments(): Promise<TournamentItem[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, name')
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
      .select('id, name')
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
      .select(
        'id, tournament_id, round_no, board_no, black_id, white_id, match_time, result, black:players!renju_matches_black_id_fkey(id, name), white:players!renju_matches_white_id_fkey(id, name)',
      )
      .eq('tournament_id', tournamentId)
      .order('round_no', { ascending: true })
      .order('board_no', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data as unknown as RenjuMatchRow[]).map(mapMatch);
  },
};
