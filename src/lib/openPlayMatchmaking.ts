/**
 * Shared matchmaking logic for Open Play.
 * Used by the admin view (to create actual matches) and the live view
 * (to preview "Up Next" from the waiting pool without mutating state).
 */

export type SkillTier = 'beginner' | 'intermediate' | 'pro';
export type BalanceMode = 'arrival_order' | 'skill_aware';

export interface Waiter {
  id: string;
  player_name: string;
  skill_tier: SkillTier;
  entered_pool_at: string;
}

export const TIER_VAL: Record<string, number> = { pro: 3, intermediate: 2, beginner: 1 };

// Centralized constants — import these everywhere; no bare numeric literals in components.
export const PLAYERS_PER_MATCH = 4;
export const MAX_SKIP = 3;
export const ANNOUNCEMENT_MS = 8000;
export const MINS_PER_GAME_LOW = 12;
export const MINS_PER_GAME_HIGH = 18;

/** Sort two waiters by (entered_pool_at ASC, id ASC) — same ordering as all DB queries. */
function poolCompare(a: Waiter, b: Waiter): number {
  const d = new Date(a.entered_pool_at).getTime() - new Date(b.entered_pool_at).getTime();
  return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Snake draft: sort 4 players by tier desc, pair highest+lowest vs 2nd+3rd.
 * Returns [teamA, teamB].
 */
export function snakeDraft(four: Waiter[]): [Waiter[], Waiter[]] {
  const ranked = [...four].sort((a, b) => TIER_VAL[b.skill_tier] - TIER_VAL[a.skill_tier]);
  return [[ranked[0], ranked[3]], [ranked[1], ranked[2]]];
}

/**
 * Select the next PLAYERS_PER_MATCH players from `pool` and pair them into two teams.
 * Returns null if pool has fewer than PLAYERS_PER_MATCH players.
 * Does NOT mutate any player state.
 */
export function makeMatch(
  pool: Waiter[],
  mode: BalanceMode = 'arrival_order'
): [Waiter[], Waiter[]] | null {
  if (pool.length < PLAYERS_PER_MATCH) return null;

  const byWait = [...pool].sort(poolCompare);

  if (mode === 'arrival_order') {
    return snakeDraft(byWait.slice(0, PLAYERS_PER_MATCH));
  }

  // skill_aware: among top (PLAYERS_PER_MATCH + MAX_SKIP) candidates find group with smallest tier spread.
  const candidates = byWait.slice(0, PLAYERS_PER_MATCH + MAX_SKIP);
  let bestGroup: Waiter[] = byWait.slice(0, PLAYERS_PER_MATCH);
  let bestSpread = Infinity;

  for (let i = 0; i < candidates.length - 3; i++) {
    for (let j = i + 1; j < candidates.length - 2; j++) {
      for (let k = j + 1; k < candidates.length - 1; k++) {
        for (let l = k + 1; l < candidates.length; l++) {
          const group = [candidates[i], candidates[j], candidates[k], candidates[l]];
          const tiers = group.map(p => TIER_VAL[p.skill_tier]);
          const spread = Math.max(...tiers) - Math.min(...tiers);
          if (spread < bestSpread) { bestSpread = spread; bestGroup = group; }
        }
      }
    }
  }

  return snakeDraft(bestGroup);
}

// ─── Round-Robin Schedule Generator ─────────────────────────────────────────

export interface RRTeam { id: string; name: string; }

export interface RRScheduleMatch {
  teamA: RRTeam;
  teamB: RRTeam | null; // null = this slot is a BYE for teamA
  round: number;
  isBye: boolean;
}

/**
 * Generate a complete round-robin schedule using the circle method.
 *
 * N teams (even) → N−1 rounds, N/2 matches per round, (N−1)×(N/2) total matches.
 * N teams (odd)  → N rounds, (N−1)/2 real matches per round (one team sits), with BYE slots.
 *
 * 8 teams → 7 rounds × 4 matches = 28 matches, each team plays exactly 7 times.
 */
export function generateRoundRobinSchedule(teams: RRTeam[]): RRScheduleMatch[] {
  const n = teams.length;
  if (n < 2) return [];

  const BYE: RRTeam = { id: '__BYE__', name: 'BYE' };
  // Even the count by adding a BYE team if needed
  const rotation = n % 2 === 1 ? [...teams.slice(1), BYE] : [...teams.slice(1)];
  const fixed = teams[0];
  const N = rotation.length + 1; // always even
  const rounds = N - 1;

  const matches: RRScheduleMatch[] = [];

  for (let round = 0; round < rounds; round++) {
    // Build this round's pairings: fixed vs rotation[0], rotation[1] vs rotation[N-2], ...
    const curr = [fixed, ...rotation];
    for (let i = 0; i < N / 2; i++) {
      const tA = curr[i];
      const tB = curr[N - 1 - i];
      if (tA.id === '__BYE__' || tB.id === '__BYE__') {
        const real = tA.id === '__BYE__' ? tB : tA;
        matches.push({ teamA: real, teamB: null, round: round + 1, isBye: true });
      } else {
        matches.push({ teamA: tA, teamB: tB, round: round + 1, isBye: false });
      }
    }
    // Rotate the non-fixed positions: move last element to front
    rotation.unshift(rotation.pop()!);
  }

  return matches;
}

/** Sort teams for standings: wins DESC → point differential DESC → points_for DESC. */
export function sortStandings<T extends { wins: number; losses: number; points_for: number; points_against: number }>(
  teams: T[]
): T[] {
  return [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffA = a.points_for - a.points_against;
    const diffB = b.points_for - b.points_against;
    if (diffB !== diffA) return diffB - diffA;
    return b.points_for - a.points_for;
  });
}
