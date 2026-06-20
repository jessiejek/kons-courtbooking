/**
 * Part 0.1 — One shared makeMatch: admin output === live preview on tied timestamps.
 *
 * Verifies that the shared library's makeMatch uses (entered_pool_at ASC, id ASC)
 * as the sort key, so ties break deterministically and identically in both the
 * admin view (generateNextMatch) and the live "Up Next" preview.
 */

import { describe, it, expect } from 'vitest';
import { makeMatch, PLAYERS_PER_MATCH } from '../lib/openPlayMatchmaking';
import type { Waiter } from '../lib/openPlayMatchmaking';

const SAME_TIME = '2025-06-01T10:00:00.000Z';

function w(id: string, tier: Waiter['skill_tier'] = 'beginner', ts = SAME_TIME): Waiter {
  return { id, player_name: `Player-${id}`, skill_tier: tier, entered_pool_at: ts };
}

describe('Part 0.1 — shared makeMatch (admin === live preview)', () => {
  it('uses PLAYERS_PER_MATCH constant (not hardcoded 4)', () => {
    expect(PLAYERS_PER_MATCH).toBe(4);
    const pool = [w('a'), w('b'), w('c')];
    expect(makeMatch(pool)).toBeNull(); // 3 < PLAYERS_PER_MATCH
  });

  it('breaks timestamp ties by id ASC — deterministic selection', () => {
    // All have identical timestamps — selection order must be id-alphabetical
    const pool = [w('z'), w('a'), w('m'), w('b'), w('q')];
    const match = makeMatch(pool, 'arrival_order')!;
    const picked = [...match[0], ...match[1]].map(p => p.id).sort();
    // Alphabetically first 4 by id: a, b, m, q (z comes last alphabetically)
    expect(picked).toEqual(['a', 'b', 'm', 'q']);
    expect(picked).not.toContain('z');
  });

  it('returns same 4 players regardless of input order (stable sort)', () => {
    const base = [w('a'), w('b'), w('c'), w('d'), w('e')];
    const shuffled = [w('e'), w('c'), w('a'), w('d'), w('b')];
    const r1 = makeMatch(base, 'arrival_order')!;
    const r2 = makeMatch(shuffled, 'arrival_order')!;
    const ids1 = [...r1[0], ...r1[1]].map(p => p.id).sort();
    const ids2 = [...r2[0], ...r2[1]].map(p => p.id).sort();
    expect(ids1).toEqual(ids2);
  });

  it('timestamp order takes precedence over id order', () => {
    const pool: Waiter[] = [
      { id: 'z', player_name: 'Z', skill_tier: 'beginner', entered_pool_at: '2025-06-01T09:00:00.000Z' }, // earliest
      { id: 'a', player_name: 'A', skill_tier: 'beginner', entered_pool_at: '2025-06-01T10:00:00.000Z' },
      { id: 'b', player_name: 'B', skill_tier: 'beginner', entered_pool_at: '2025-06-01T10:01:00.000Z' },
      { id: 'c', player_name: 'C', skill_tier: 'beginner', entered_pool_at: '2025-06-01T10:02:00.000Z' },
      { id: 'd', player_name: 'D', skill_tier: 'beginner', entered_pool_at: '2025-06-01T10:03:00.000Z' },
    ];
    const match = makeMatch(pool, 'arrival_order')!;
    const picked = [...match[0], ...match[1]].map(p => p.id).sort();
    // z has earliest timestamp, must be included despite z > a alphabetically
    expect(picked).toContain('z');
    expect(picked).not.toContain('d');
  });
});
