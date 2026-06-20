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

const MAX_SKIP = 3;

/** Sort two waiters by (entered_pool_at ASC, id ASC) — same as all DB queries. */
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
 * Select the next 4 players from `pool` and pair them into two teams.
 * Returns null if pool has fewer than 4 players.
 * Does NOT mutate any player state.
 */
export function makeMatch(
  pool: Waiter[],
  mode: BalanceMode = 'arrival_order'
): [Waiter[], Waiter[]] | null {
  if (pool.length < 4) return null;

  const byWait = [...pool].sort(poolCompare);

  if (mode === 'arrival_order') {
    return snakeDraft(byWait.slice(0, 4));
  }

  // skill_aware: among top (4 + MAX_SKIP) candidates find the group of 4 with smallest tier spread.
  const candidates = byWait.slice(0, 4 + MAX_SKIP);
  let bestGroup: Waiter[] = byWait.slice(0, 4);
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
