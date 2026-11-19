import { requireSupabase } from '@/lib/supabase';
import type {
  FootballMatch,
  FootballStanding,
  PlayerInfo,
  RenjuBracketMatch,
  RenjuMatch,
  StandingsZone,
  TiebreakerKey,
  TournamentItem,
  TournamentSport,
} from '@/types/match';

interface TournamentRow {
  id: number;
  name: string;
  sport: TournamentSport | null;
  win_points: number;
  draw_points: number;
  loss_points: number;
  tiebreakers: TiebreakerKey[] | null;
  qualify_count: number | null;
  qualify_label: string | null;
  logo_url: string | null;
  standings_zones: StandingsZone[] | null;
  total_rounds: number;
  rules_text: string;
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

interface FootballMatchRow {
  id: number;
  tournament_id: number;
  round_no: number;
  match_time: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
}

interface FootballStandingRow {
  rank: number;
  team_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  points: number;
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
    sport: row.sport ?? 'renju',
    winPoints: Number(row.win_points ?? 1),
    drawPoints: Number(row.draw_points ?? 0.5),
    lossPoints: Number(row.loss_points ?? 0),
    tiebreakers: Array.isArray(row.tiebreakers)
      ? row.tiebreakers
      : ['buchholz', 'median_buchholz', 'wins'],
    qualifyCount: row.qualify_count ?? null,
    qualifyLabel: row.qualify_label || '录取',
    logoUrl: row.logo_url || undefined,
    standingsZones: Array.isArray(row.standings_zones) ? row.standings_zones : [],
    totalRounds: row.total_rounds ?? 9,
    rulesText: row.rules_text ?? '',
  };
}

function mapMatch(row: RenjuMatchRow, noMap: Map<string, number>): RenjuMatch {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    roundNo: row.round_no,
    boardNo: row.board_no,
    blackId: row.black_id,
    blackNo: noMap.get(row.black_id),
    blackName: unwrapPlayer(row.black, row.black_id),
    whiteId: row.white_id,
    whiteNo: noMap.get(row.white_id),
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
      .select(
        'id, name, sport, win_points, draw_points, loss_points, tiebreakers, qualify_count, qualify_label, logo_url, standings_zones, total_rounds, rules_text',
      )
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
      .select(
        'id, name, sport, win_points, draw_points, loss_points, tiebreakers, qualify_count, qualify_label, logo_url, standings_zones, total_rounds, rules_text',
      )
      .eq('id', tournamentId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapTournament(data as TournamentRow) : null;
  },

  async getMatchesByTournament(tournamentId: number): Promise<RenjuMatch[]> {
    const supabase = requireSupabase();
    const [matchesRes, playersRes] = await Promise.all([
      supabase
        .from('renju_matches')
        .select(
          'id, tournament_id, round_no, board_no, black_id, white_id, match_time, result, black:players!renju_matches_black_id_fkey(id, name), white:players!renju_matches_white_id_fkey(id, name)',
        )
        .eq('tournament_id', tournamentId)
        .order('round_no', { ascending: true })
        .order('board_no', { ascending: true }),
      supabase
        .from('tournament_players')
        .select('player_id, player_no')
        .eq('tournament_id', tournamentId),
    ]);

    if (matchesRes.error) {
      throw new Error(matchesRes.error.message);
    }

    const noMap = new Map<string, number>();
    if (playersRes.data) {
      for (const p of playersRes.data) {
        noMap.set(p.player_id as string, p.player_no as number);
      }
    }

    return (matchesRes.data as unknown as RenjuMatchRow[]).map((row) =>
      mapMatch(row, noMap),
    );
  },

  async getFootballMatches(tournamentId: number): Promise<FootballMatch[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('football_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_no', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data as FootballMatchRow[]).map((r) => ({
      id: r.id,
      tournamentId: r.tournament_id,
      roundNo: r.round_no,
      matchTime: r.match_time,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeScore: r.home_score,
      awayScore: r.away_score,
    }));
  },

  async getFootballStandings(tournamentId: number): Promise<FootballStanding[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('football_standings')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('rank', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data as FootballStandingRow[]).map((r) => ({
      rank: r.rank,
      teamName: r.team_name,
      played: r.played,
      wins: r.wins,
      draws: r.draws,
      losses: r.losses,
      goalsFor: r.goals_for,
      goalsAgainst: r.goals_against,
      points: r.points,
    }));
  },

  async getFootballDeductions(tournamentId: number): Promise<Map<string, number>> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('football_team_deductions')
      .select('team_name, deduction')
      .eq('tournament_id', tournamentId);

    if (error) {
      throw new Error(error.message);
    }

    const map = new Map<string, number>();
    for (const r of data as { team_name: string; deduction: number }[]) {
      map.set(r.team_name, Number(r.deduction ?? 0));
    }
    return map;
  },

  async getFootballTeamLogos(tournamentId: number): Promise<Map<string, string>> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('football_teams')
      .select('team_name, logo_url')
      .eq('tournament_id', tournamentId);

    const map = new Map<string, string>();
    if (error || !data) {
      return map;
    }

    for (const r of data as { team_name: string; logo_url: string }[]) {
      if (r.logo_url) {
        map.set(r.team_name, r.logo_url);
      }
    }
    return map;
  },

  async getBracketMatches(tournamentId: number): Promise<RenjuBracketMatch[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('renju_bracket_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('stage_round', { ascending: true })
      .order('match_order', { ascending: true });

    if (error || !data) {
      return [];
    }

    return (
      data as {
        id: number;
        tournament_id: number;
        stage_round: number;
        match_order: number;
        bracket_type: 'main' | 'third_place';
        round_label: string;
        match_time: string;
        player1_name: string;
        player1_seed: number | null;
        player1_score: string;
        player2_name: string;
        player2_seed: number | null;
        player2_score: string;
        winner_slot: 1 | 2;
      }[]
    ).map((r) => ({
      id: r.id,
      tournamentId: r.tournament_id,
      stageRound: r.stage_round,
      matchOrder: r.match_order,
      bracketType: r.bracket_type,
      roundLabel: r.round_label,
      matchTime: r.match_time,
      player1Name: r.player1_name,
      player1Seed: r.player1_seed ?? undefined,
      player1Score: r.player1_score,
      player2Name: r.player2_name,
      player2Seed: r.player2_seed ?? undefined,
      player2Score: r.player2_score,
      winnerSlot: r.winner_slot,
    }));
  },
};
