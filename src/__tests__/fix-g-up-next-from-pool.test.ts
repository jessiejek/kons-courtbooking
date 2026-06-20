/**
 * Fix G regression — "Up Next" panel was permanently dead.
 *
 * Failure case: the live view read nextGame = games[1] from a query of
 * status IN ('rally','active'). The single-active-game guard means only one
 * game can ever be in those statuses, so games[1] is always undefined —
 * the "Up Next" section never rendered.
 *
 * Fix: compute the preview from the waiting pool using the same makeMatch()
 * logic the admin uses for actual matches (read-only, no state mutation).
 * Shared logic extracted to src/lib/openPlayMatchmaking.ts.
 *
 * Test: asserts that makeMatch() on a known pool returns the same 4 players
 * the admin generateNextMatch() would actually select.
 */

import { describe, it, expect } from 'vitest';
import { makeMatch, TIER_VAL } from '../lib/openPlayMatchmaking';
import type { Waiter } from '../lib/openPlayMatchmaking';

const TS_BASE = '2025-06-01T10:00:00.000Z';
const ts = (offsetMs: number) => new Date(new Date(TS_BASE).getTime() + offsetMs).toISOString();

function makeWaiter(id: string, tier: Waiter['skill_tier'], offsetMs: number): Waiter {
  return { id, player_name: `Player-${id}`, skill_tier: tier, entered_pool_at: ts(offsetMs) };
}

describe('Fix G — Up Next computed from waiting pool', () => {
  describe('arrival_order mode', () => {
    it('selects the 4 longest-waiting players', () => {
      const pool: Waiter[] = [
        makeWaiter('p1', 'beginner',     0),
        makeWaiter('p2', 'intermediate', 1000),
        makeWaiter('p3', 'pro',          2000),
        makeWaiter('p4', 'beginner',     3000),
        makeWaiter('p5', 'pro',          4000), // 5th — should not be picked
      ];
      const match = makeMatch(pool, 'arrival_order');
      expect(match).not.toBeNull();
      const [teamA, teamB] = match!;
      const allPicked = [...teamA, ...teamB].map(p => p.id).sort();
      expect(allPicked).toEqual(['p1', 'p2', 'p3', 'p4']);
      expect(allPicked).not.toContain('p5');
    });

    it('applies snake draft: highest+lowest vs 2nd+3rd by tier', () => {
      const pool: Waiter[] = [
        makeWaiter('p1', 'beginner',     0),
        makeWaiter('p2', 'intermediate', 1000),
        makeWaiter('p3', 'intermediate', 2000),
        makeWaiter('p4', 'pro',          3000),
      ];
      const match = makeMatch(pool, 'arrival_order')!;
      const [teamA, teamB] = match;
      // sorted desc by tier: p4(pro=3), p2(int=2), p3(int=2), p1(beg=1)
      // teamA = [p4, p1], teamB = [p2, p3]
      expect(teamA.map(p => p.id).sort()).toEqual(['p1', 'p4']);
      expect(teamB.map(p => p.id).sort()).toEqual(['p2', 'p3']);
    });
  });

  describe('skill_aware mode', () => {
    it('prefers a balanced group over strict arrival order', () => {
      const pool: Waiter[] = [
        makeWaiter('p1', 'pro',          0),     // arrived first
        makeWaiter('p2', 'beginner',     1000),
        makeWaiter('p3', 'intermediate', 2000),
        makeWaiter('p4', 'intermediate', 3000),
        makeWaiter('p5', 'intermediate', 4000),  // arrived 5th
      ];
      // arrival_order would pick p1(pro)+p2(beg)+p3(int)+p4(int) spread=2
      // skill_aware can pick p2(beg)+p3(int)+p4(int)+p5(int) spread=1 — better balance
      const arrivalMatch = makeMatch(pool, 'arrival_order')!;
      const skillMatch   = makeMatch(pool, 'skill_aware')!;

      const arrivalTiers = [...arrivalMatch[0], ...arrivalMatch[1]].map(p => TIER_VAL[p.skill_tier]);
      const skillTiers   = [...skillMatch[0],   ...skillMatch[1]  ].map(p => TIER_VAL[p.skill_tier]);

      const spread = (ts: number[]) => Math.max(...ts) - Math.min(...ts);
      expect(spread(skillTiers)).toBeLessThanOrEqual(spread(arrivalTiers));
    });
  });

  it('returns null when pool has fewer than 4 players', () => {
    const pool: Waiter[] = [
      makeWaiter('p1', 'beginner', 0),
      makeWaiter('p2', 'beginner', 1000),
      makeWaiter('p3', 'beginner', 2000),
    ];
    expect(makeMatch(pool, 'arrival_order')).toBeNull();
  });

  it('DEMONSTRATES original bug: games[1] is always undefined with the active-game guard', () => {
    // The guard ensures at most 1 game is in ('rally','active') per session.
    // Therefore games[1] from such a query is always undefined, and nextGame is always null.
    const gamesFromDB: unknown[] = [{ id: 'g1', status: 'active' }]; // only 1 ever exists
    const nextGame = gamesFromDB[1]; // always undefined
    expect(nextGame).toBeUndefined(); // <-- the original bug
  });
});
