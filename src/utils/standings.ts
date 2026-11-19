import type { RenjuMatch, TiebreakerKey, TournamentItem } from '@/types/match';

export interface StandingEntry {
  playerId: string;
  playerNo?: number;
  playerName: string;
  played: number;
  wins: number;
  tiebreakWins: number;
  draws: number;
  losses: number;
  points: number;
  buchholz: number;
  medianBuchholz: number;
  rank: number;
}

interface PlayerAccumulator {
  playerId: string;
  playerNo?: number;
  playerName: string;
  played: number;
  wins: number;
  tiebreakWins: number;
  draws: number;
  losses: number;
  points: number;
  forfeitCount: number;
  oppForfeitCount: number;
  byeCount: number;
  rounds: Map<number, string>; // roundNo -> opponentId | 'BYE'
  virtualPoints: number;
}

export function computeStandings(
  matches: RenjuMatch[],
  tournament: TournamentItem | null,
  upToRound?: number,
): StandingEntry[] {
  const winPts = tournament?.winPoints ?? 1;
  const drawPts = tournament?.drawPoints ?? 0.5;
  const lossPts = tournament?.lossPoints ?? 0;
  const maxRoundInMatches = Math.max(1, ...matches.map((m) => m.roundNo));
  const totalRounds =
    upToRound ?? tournament?.totalRounds ?? maxRoundInMatches;
  const scopedMatches = matches.filter((m) => m.roundNo <= totalRounds);
  const tiebreakers: TiebreakerKey[] = tournament?.tiebreakers ?? [
    'buchholz',
    'median_buchholz',
    'wins',
  ];

  const map = new Map<string, PlayerAccumulator>();

  function ensure(id: string, no: number | undefined, name: string) {
    if (id === 'BYE') return null;
    let acc = map.get(id);
    if (!acc) {
      acc = {
        playerId: id,
        playerNo: no,
        playerName: name,
        played: 0,
        wins: 0,
        tiebreakWins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        forfeitCount: 0,
        oppForfeitCount: 0,
        byeCount: 0,
        rounds: new Map(),
        virtualPoints: 0,
      };
      map.set(id, acc);
    }
    return acc;
  }

  for (const m of scopedMatches) {
    const black = ensure(m.blackId, m.blackNo, m.blackName);
    const white = ensure(m.whiteId, m.whiteNo, m.whiteName);

    if (m.whiteId === 'BYE') {
      if (black) {
        black.rounds.set(m.roundNo, 'BYE');
        black.byeCount += 1;
        if (m.result) {
          black.played += 1;
          black.wins += 1;
          black.points += winPts;
        }
      }
      continue;
    }

    if (black) black.rounds.set(m.roundNo, m.whiteId);
    if (white) white.rounds.set(m.roundNo, m.blackId);

    if (!m.result) continue;

    if (m.result === 'B' || m.result === '1:0') {
      if (black) {
        black.played += 1;
        black.wins += 1;
        black.tiebreakWins += 1;
        black.points += winPts;
      }
      if (white) {
        white.played += 1;
        white.losses += 1;
        white.points += lossPts;
      }
    } else if (m.result === 'W' || m.result === '0:1') {
      if (black) {
        black.played += 1;
        black.losses += 1;
        black.points += lossPts;
      }
      if (white) {
        white.played += 1;
        white.wins += 1;
        white.tiebreakWins += 1;
        white.points += winPts;
      }
    } else if (m.result === 'D' || m.result === '0.5:0.5') {
      if (black) {
        black.played += 1;
        black.draws += 1;
        black.points += drawPts;
      }
      if (white) {
        white.played += 1;
        white.draws += 1;
        white.points += drawPts;
      }
    } else if (m.result === '-' || m.result === 'BF') {
      if (black) {
        black.played += 1;
        black.losses += 1;
        black.points += lossPts;
        black.forfeitCount += 1;
      }
      if (white) {
        white.played += 1;
        white.wins += 1;
        white.points += winPts;
        white.oppForfeitCount += 1;
      }
    } else if (m.result === '+' || m.result === 'WF') {
      if (black) {
        black.played += 1;
        black.wins += 1;
        black.points += winPts;
        black.oppForfeitCount += 1;
      }
      if (white) {
        white.played += 1;
        white.losses += 1;
        white.points += lossPts;
        white.forfeitCount += 1;
      }
    }
  }

  for (const acc of map.values()) {
    const withdrawnCount = Math.max(0, totalRounds - acc.rounds.size);
    acc.virtualPoints =
      acc.points +
      0.5 *
        (acc.forfeitCount +
          withdrawnCount -
          acc.oppForfeitCount -
          acc.byeCount);
  }

  const entries: Omit<StandingEntry, 'rank'>[] = [];
  for (const acc of map.values()) {
    const oppScores: number[] = [];
    for (let r = 1; r <= totalRounds; r += 1) {
      const oppId = acc.rounds.get(r);
      if (!oppId) {
        oppScores.push(0);
      } else if (oppId === 'BYE') {
        oppScores.push(0.5 * totalRounds);
      } else {
        const opp = map.get(oppId);
        oppScores.push(opp ? opp.virtualPoints : 0);
      }
    }

    const sum = oppScores.reduce((s, v) => s + v, 0);
    const median =
      oppScores.length >= 3
        ? sum - Math.max(...oppScores) - Math.min(...oppScores)
        : 0;

    entries.push({
      playerId: acc.playerId,
      playerNo: acc.playerNo,
      playerName: acc.playerName,
      played: acc.played,
      wins: acc.wins,
      tiebreakWins: acc.tiebreakWins,
      draws: acc.draws,
      losses: acc.losses,
      points: acc.points,
      buchholz: sum,
      medianBuchholz: median,
    });
  }

  function compareEntries(
    a: Omit<StandingEntry, 'rank'>,
    b: Omit<StandingEntry, 'rank'>,
  ): number {
    if (b.points !== a.points) return b.points - a.points;
    for (const key of tiebreakers) {
      if (key === 'buchholz' && b.buchholz !== a.buchholz) {
        return b.buchholz - a.buchholz;
      }
      if (key === 'median_buchholz' && b.medianBuchholz !== a.medianBuchholz) {
        return b.medianBuchholz - a.medianBuchholz;
      }
      if (key === 'wins' && b.tiebreakWins !== a.tiebreakWins) {
        return b.tiebreakWins - a.tiebreakWins;
      }
    }
    return 0;
  }

  const sorted = entries.sort((a, b) => {
    const cmp = compareEntries(a, b);
    if (cmp !== 0) return cmp;
    return (a.playerNo ?? 999) - (b.playerNo ?? 999);
  });

  let currentRank = 1;
  return sorted.map((item, idx) => {
    if (idx > 0 && compareEntries(sorted[idx - 1], item) !== 0) {
      currentRank = idx + 1;
    }
    return { ...item, rank: currentRank };
  });
}
