import type {
  FootballMatch,
  FootballStanding,
  RenjuMatch,
  TiebreakerKey,
  TournamentItem,
} from '@/types/match';

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
  progressiveBuchholz?: string;
  directEncounter?: string;
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
  const sortedOppsMap = new Map<string, number[]>();

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

    const sortedOpps = [...oppScores].sort((a, b) => a - b);
    sortedOppsMap.set(acc.playerId, sortedOpps);

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
      progressiveBuchholz: '',
      directEncounter: '',
    });
  }

  // Build head-to-head points map for direct_encounter tiebreaker
  const h2hMap = new Map<string, Map<string, number>>();
  const addH2H = (aId: string, bId: string, pts: number) => {
    let inner = h2hMap.get(aId);
    if (!inner) {
      inner = new Map();
      h2hMap.set(aId, inner);
    }
    inner.set(bId, (inner.get(bId) ?? 0) + pts);
  };

  for (const m of scopedMatches) {
    if (!m.result || m.whiteId === 'BYE' || m.blackId === 'BYE') continue;
    if (m.result === 'B' || m.result === '+' || m.result === 'WF' || m.result === '1:0') {
      addH2H(m.blackId, m.whiteId, 1);
      addH2H(m.whiteId, m.blackId, 0);
    } else if (m.result === 'W' || m.result === '-' || m.result === 'BF' || m.result === '0:1') {
      addH2H(m.blackId, m.whiteId, 0);
      addH2H(m.whiteId, m.blackId, 1);
    } else if (m.result === 'D' || m.result === '0.5:0.5') {
      addH2H(m.blackId, m.whiteId, 0.5);
      addH2H(m.whiteId, m.blackId, 0.5);
    }
  }

  function remSum(playerId: string, dropCount: number): number {
    const arr = sortedOppsMap.get(playerId) ?? [];
    let s = 0;
    for (let i = dropCount; i < arr.length; i += 1) {
      s += arr[i];
    }
    return s;
  }

  function compareProgressive(aId: string, bId: string): number {
    const len = Math.max(
      sortedOppsMap.get(aId)?.length ?? 0,
      sortedOppsMap.get(bId)?.length ?? 0,
    );
    for (let x = 1; x <= len; x += 1) {
      const diff = remSum(bId, x) - remSum(aId, x);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  const deScoreMap = new Map<string, number>();

  function compareUpTo(
    a: Omit<StandingEntry, 'rank'>,
    b: Omit<StandingEntry, 'rank'>,
    limitKeys: TiebreakerKey[],
  ): number {
    if (b.points !== a.points) return b.points - a.points;
    for (const key of limitKeys) {
      if (key === 'buchholz' && b.buchholz !== a.buchholz) {
        return b.buchholz - a.buchholz;
      }
      if (key === 'median_buchholz' && b.medianBuchholz !== a.medianBuchholz) {
        return b.medianBuchholz - a.medianBuchholz;
      }
      if (key === 'progressive_buchholz') {
        const cmp = compareProgressive(a.playerId, b.playerId);
        if (cmp !== 0) return cmp;
      }
      if (key === 'wins' && b.tiebreakWins !== a.tiebreakWins) {
        return b.tiebreakWins - a.tiebreakWins;
      }
      if (key === 'direct_encounter') {
        const bScore = deScoreMap.get(b.playerId);
        const aScore = deScoreMap.get(a.playerId);
        if (bScore !== undefined && aScore !== undefined && bScore !== aScore) {
          return bScore - aScore;
        }
      }
    }
    return 0;
  }

  function compareEntries(
    a: Omit<StandingEntry, 'rank'>,
    b: Omit<StandingEntry, 'rank'>,
  ): number {
    return compareUpTo(a, b, tiebreakers);
  }

  // Populate direct_encounter only when players are tied on all preceding tiebreakers
  // AND every pair in the tied group has played each other ("两两都遇到才能比")
  const deIdx = tiebreakers.indexOf('direct_encounter');
  if (deIdx !== -1) {
    const beforeKeys = tiebreakers.slice(0, deIdx);
    entries.sort((a, b) => compareUpTo(a, b, beforeKeys));
    let i = 0;
    while (i < entries.length) {
      let j = i + 1;
      while (j < entries.length && compareUpTo(entries[i], entries[j], beforeKeys) === 0) {
        j += 1;
      }
      if (j - i > 1) {
        const group = entries.slice(i, j);
        let allMet = true;
        for (let a = 0; a < group.length && allMet; a += 1) {
          for (let b = a + 1; b < group.length; b += 1) {
            if (!h2hMap.get(group[a].playerId)?.has(group[b].playerId)) {
              allMet = false;
              break;
            }
          }
        }
        if (allMet) {
          for (const cur of group) {
            const inner = h2hMap.get(cur.playerId);
            let sum = 0;
            for (const peer of group) {
              if (peer.playerId === cur.playerId) continue;
              sum += inner?.get(peer.playerId) ?? 0;
            }
            deScoreMap.set(cur.playerId, sum);
            cur.directEncounter = String(sum);
          }
        }
      }
      i = j;
    }
  }

  const sorted = entries.sort((a, b) => {
    const cmp = compareEntries(a, b);
    if (cmp !== 0) return cmp;
    return (a.playerNo ?? 999) - (b.playerNo ?? 999);
  });

  // Populate progressive_buchholz ("x-y") only when needed to distinguish tied players
  const progIdx = tiebreakers.indexOf('progressive_buchholz');
  if (progIdx !== -1) {
    const beforeKeys = tiebreakers.slice(0, progIdx);
    let i = 0;
    while (i < sorted.length) {
      let j = i + 1;
      while (j < sorted.length && compareUpTo(sorted[i], sorted[j], beforeKeys) === 0) {
        j += 1;
      }
      if (j - i > 1) {
        const group = sorted.slice(i, j);
        for (let k = 0; k < group.length; k += 1) {
          const cur = group[k];
          const maxDrops = sortedOppsMap.get(cur.playerId)?.length ?? 0;
          let maxNeededX = 0;
          for (let m = 0; m < group.length; m += 1) {
            if (m === k) continue;
            const peer = group[m];
            let distinguished = false;
            for (let x = 1; x <= maxDrops; x += 1) {
              if (remSum(cur.playerId, x) !== remSum(peer.playerId, x)) {
                if (x > maxNeededX) maxNeededX = x;
                distinguished = true;
                break;
              }
            }
            if (!distinguished && maxDrops > maxNeededX) {
              maxNeededX = maxDrops;
            }
          }
          if (maxNeededX > 0) {
            cur.progressiveBuchholz = `${maxNeededX}-${remSum(cur.playerId, maxNeededX)}`;
          }
        }
      }
      i = j;
    }
  }

  let currentRank = 1;
  return sorted.map((item, idx) => {
    if (idx > 0 && compareEntries(sorted[idx - 1], item) !== 0) {
      currentRank = idx + 1;
    }
    return { ...item, rank: currentRank };
  });
}

/**
 * Compute per-round football standings up to `upToRound`, applying season point deductions
 * and sorting ties by head-to-head record (when all tied teams have met) then goal difference.
 */
export function computeFootballStandings(
  matches: FootballMatch[],
  deductions: Map<string, number>,
  tournament: TournamentItem | null,
  upToRound?: number,
): FootballStanding[] {
  if (matches.length === 0) return [];

  const winPts = tournament?.winPoints ?? 3;
  const drawPts = tournament?.drawPoints ?? 1;
  const lossPts = tournament?.lossPoints ?? 0;
  const tiebreakers: TiebreakerKey[] =
    tournament?.tiebreakers && tournament.tiebreakers.length > 0
      ? tournament.tiebreakers
      : ['h2h_points', 'h2h_gd', 'h2h_gf', 'gd', 'gf'];

  const maxRound = Math.max(1, ...matches.map((m) => m.roundNo));
  const limitRound = upToRound ?? maxRound;
  const scopedMatches = matches.filter(
    (m) => m.roundNo <= limitRound && m.homeScore !== null && m.awayScore !== null,
  );

  const statsMap = new Map<string, Omit<FootballStanding, 'rank'>>();
  const ensureTeam = (name: string) => {
    let entry = statsMap.get(name);
    if (!entry) {
      entry = {
        teamName: name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: -(deductions.get(name) ?? 0),
      };
      statsMap.set(name, entry);
    }
    return entry;
  };

  for (const m of matches) {
    ensureTeam(m.homeTeam);
    ensureTeam(m.awayTeam);
  }

  for (const m of scopedMatches) {
    const home = ensureTeam(m.homeTeam);
    const away = ensureTeam(m.awayTeam);
    const hs = m.homeScore!;
    const as = m.awayScore!;

    home.played += 1;
    away.played += 1;
    home.goalsFor += hs;
    home.goalsAgainst += as;
    away.goalsFor += as;
    away.goalsAgainst += hs;

    if (hs > as) {
      home.wins += 1;
      home.points += winPts;
      away.losses += 1;
      away.points += lossPts;
    } else if (hs < as) {
      away.wins += 1;
      away.points += winPts;
      home.losses += 1;
      home.points += lossPts;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += drawPts;
      away.points += drawPts;
    }
  }

  const byPoints = new Map<number, Omit<FootballStanding, 'rank'>[]>();
  for (const row of statsMap.values()) {
    const group = byPoints.get(row.points) ?? [];
    group.push(row);
    byPoints.set(row.points, group);
  }

  const sortedPoints = Array.from(byPoints.keys()).sort((a, b) => b - a);
  const ordered: Omit<FootballStanding, 'rank'>[] = [];
  const usesH2H = tiebreakers.some((k) => k.startsWith('h2h_'));

  for (const pts of sortedPoints) {
    const group = byPoints.get(pts)!;
    if (group.length > 1) {
      const h2h = new Map<string, { pts: number; gd: number; gf: number }>();
      let allMet = false;

      if (usesH2H) {
        const groupNames = new Set(group.map((g) => g.teamName));
        const pairsPlayed = new Set<string>();
        for (const name of groupNames) {
          h2h.set(name, { pts: 0, gd: 0, gf: 0 });
        }

        for (const m of scopedMatches) {
          if (!groupNames.has(m.homeTeam) || !groupNames.has(m.awayTeam)) continue;
          const hs = m.homeScore!;
          const as = m.awayScore!;
          const key =
            m.homeTeam < m.awayTeam
              ? `${m.homeTeam}|${m.awayTeam}`
              : `${m.awayTeam}|${m.homeTeam}`;
          pairsPlayed.add(key);

          const hStat = h2h.get(m.homeTeam)!;
          const aStat = h2h.get(m.awayTeam)!;
          hStat.gf += hs;
          hStat.gd += hs - as;
          aStat.gf += as;
          aStat.gd += as - hs;

          if (hs > as) {
            hStat.pts += winPts;
            aStat.pts += lossPts;
          } else if (hs < as) {
            aStat.pts += winPts;
            hStat.pts += lossPts;
          } else {
            hStat.pts += drawPts;
            aStat.pts += drawPts;
          }
        }

        const expectedPairs = (group.length * (group.length - 1)) / 2;
        allMet = pairsPlayed.size === expectedPairs;
      }

      group.sort((a, b) => {
        for (const key of tiebreakers) {
          if (key === 'h2h_points' && allMet) {
            const diff = h2h.get(b.teamName)!.pts - h2h.get(a.teamName)!.pts;
            if (diff !== 0) return diff;
          } else if (key === 'h2h_gd' && allMet) {
            const diff = h2h.get(b.teamName)!.gd - h2h.get(a.teamName)!.gd;
            if (diff !== 0) return diff;
          } else if (key === 'h2h_gf' && allMet) {
            const diff = h2h.get(b.teamName)!.gf - h2h.get(a.teamName)!.gf;
            if (diff !== 0) return diff;
          } else if (key === 'gd') {
            const diff =
              b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst);
            if (diff !== 0) return diff;
          } else if (key === 'gf') {
            const diff = b.goalsFor - a.goalsFor;
            if (diff !== 0) return diff;
          } else if (key === 'wins') {
            const diff = b.wins - a.wins;
            if (diff !== 0) return diff;
          }
        }
        return a.teamName.localeCompare(b.teamName, 'zh-CN');
      });
    }
    ordered.push(...group);
  }

  return ordered.map((item, idx) => ({ ...item, rank: idx + 1 }));
}
