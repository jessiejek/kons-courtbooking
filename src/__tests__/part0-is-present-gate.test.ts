/**
 * Part 0.3 — is_present gate: only present players enter the match pool.
 *
 * Failure mode before fix: the pool query fetched ALL 'waiting' players,
 * including those who had registered online but hadn't shown up at the court
 * (is_present = false). They could be selected for a match while physically absent.
 *
 * Fix: pool query adds .eq('is_present', true) so absent registrants are invisible
 * to the matchmaker until admin marks them present.
 *
 * This test simulates the filter in pure logic (the DB filter is on the Supabase side;
 * we test that makeMatch with a pre-filtered pool correctly excludes absent players).
 */

import { describe, it, expect } from 'vitest';
import { makeMatch, PLAYERS_PER_MATCH } from '../lib/openPlayMatchmaking';
import type { Waiter } from '../lib/openPlayMatchmaking';

type ExtendedWaiter = Waiter & { is_present: boolean };

function w(id: string, present: boolean, ts: string): ExtendedWaiter {
  return { id, player_name: `Player-${id}`, skill_tier: 'beginner', entered_pool_at: ts, is_present: present };
}

const ts = (ms: number) => new Date(new Date('2025-06-01T10:00:00.000Z').getTime() + ms).toISOString();

describe('Part 0.3 — is_present gate', () => {
  it('absent players must not be in the match pool passed to makeMatch', () => {
    const allWaiting: ExtendedWaiter[] = [
      w('present-1', true,  ts(0)),
      w('absent-2',  false, ts(1000)),  // registered, not checked in
      w('present-3', true,  ts(2000)),
      w('absent-4',  false, ts(3000)),  // registered, not checked in
      w('present-5', true,  ts(4000)),
      w('present-6', true,  ts(5000)),
    ];

    // Simulates the .eq('is_present', true) DB filter
    const presentPool = allWaiting.filter(r => r.is_present);
    expect(presentPool.length).toBe(4); // exactly PLAYERS_PER_MATCH present players

    const match = makeMatch(presentPool, 'arrival_order');
    expect(match).not.toBeNull();
    const pickedIds = [...match![0], ...match![1]].map(p => p.id);
    expect(pickedIds).not.toContain('absent-2');
    expect(pickedIds).not.toContain('absent-4');
    expect(pickedIds).toContain('present-1');
    expect(pickedIds).toContain('present-3');
    expect(pickedIds).toContain('present-5');
    expect(pickedIds).toContain('present-6');
  });

  it('returns null when fewer than PLAYERS_PER_MATCH present players exist', () => {
    const allWaiting: ExtendedWaiter[] = [
      w('present-1', true,  ts(0)),
      w('absent-2',  false, ts(1000)),
      w('present-3', true,  ts(2000)),
      w('absent-4',  false, ts(3000)),
      w('absent-5',  false, ts(4000)),
    ];
    const presentPool = allWaiting.filter(r => r.is_present);
    expect(presentPool.length).toBeLessThan(PLAYERS_PER_MATCH);
    expect(makeMatch(presentPool, 'arrival_order')).toBeNull();
  });

  it('all 4 required present players are selected when exactly 4 are present', () => {
    const allWaiting: ExtendedWaiter[] = [
      w('p1', true,  ts(0)),
      w('p2', false, ts(500)),    // absent — must not be selected
      w('p3', true,  ts(1000)),
      w('p4', true,  ts(1500)),
      w('p5', true,  ts(2000)),
    ];
    const presentPool = allWaiting.filter(r => r.is_present);
    const match = makeMatch(presentPool, 'arrival_order')!;
    const ids = [...match[0], ...match[1]].map(p => p.id).sort();
    expect(ids).toEqual(['p1', 'p3', 'p4', 'p5']);
    expect(ids).not.toContain('p2');
  });
});
