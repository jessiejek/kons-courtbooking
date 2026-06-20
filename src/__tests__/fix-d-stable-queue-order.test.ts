/**
 * Fix D regression — nondeterministic queue order on tied timestamps.
 *
 * Failure case: after re-queue, both losers get identical entered_pool_at and
 * both winners get identical entered_pool_at. When the next pick boundary falls
 * across tied players, the selected player is DB-order-dependent (nondeterministic).
 *
 * Fix: add `ORDER BY entered_pool_at ASC, id ASC` everywhere the pool is read.
 * The secondary id sort is deterministic (uuid/serial is unique and stable).
 *
 * This test validates that the comparator used in the sort produces a stable,
 * deterministic ordering when timestamps are equal.
 */

import { describe, it, expect } from 'vitest';

interface PlayerStub {
  id: string;
  entered_pool_at: string;
}

// The comparator that the fixed ORDER BY clause implements.
function poolOrder(a: PlayerStub, b: PlayerStub): number {
  const tsDiff = new Date(a.entered_pool_at).getTime() - new Date(b.entered_pool_at).getTime();
  if (tsDiff !== 0) return tsDiff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; // id ASC secondary
}

describe('Fix D — deterministic pool ordering with tied timestamps', () => {
  const TIED_TS = '2025-06-01T10:00:00.001Z';

  it('players with identical timestamps are ordered by id', () => {
    const players: PlayerStub[] = [
      { id: 'uuid-c', entered_pool_at: TIED_TS },
      { id: 'uuid-a', entered_pool_at: TIED_TS },
      { id: 'uuid-b', entered_pool_at: TIED_TS },
    ];
    const sorted = [...players].sort(poolOrder);
    expect(sorted.map(p => p.id)).toEqual(['uuid-a', 'uuid-b', 'uuid-c']);
  });

  it('ordering is stable across repeated sorts of the same input', () => {
    const players: PlayerStub[] = [
      { id: 'uuid-z', entered_pool_at: TIED_TS },
      { id: 'uuid-m', entered_pool_at: TIED_TS },
      { id: 'uuid-a', entered_pool_at: TIED_TS },
    ];
    const sort1 = [...players].sort(poolOrder).map(p => p.id);
    const sort2 = [...players].sort(poolOrder).map(p => p.id);
    expect(sort1).toEqual(sort2);
    expect(sort1).toEqual(['uuid-a', 'uuid-m', 'uuid-z']);
  });

  it('earlier timestamp still wins over later timestamp regardless of id', () => {
    const players: PlayerStub[] = [
      { id: 'uuid-a', entered_pool_at: '2025-06-01T10:00:01.000Z' }, // later
      { id: 'uuid-z', entered_pool_at: '2025-06-01T10:00:00.000Z' }, // earlier, high id
    ];
    const sorted = [...players].sort(poolOrder);
    expect(sorted[0].id).toBe('uuid-z'); // earlier ts wins even though id is lexically later
  });

  it('DEMONSTRATES the original problem: without id sort, tied timestamps are nondeterministic', () => {
    // Without the secondary sort, JS sort is not guaranteed to be stable for
    // equal keys. Here we just verify that the primary sort alone cannot
    // distinguish tied players.
    const players: PlayerStub[] = [
      { id: 'uuid-c', entered_pool_at: TIED_TS },
      { id: 'uuid-a', entered_pool_at: TIED_TS },
    ];
    const primaryOnly = (a: PlayerStub, b: PlayerStub) =>
      new Date(a.entered_pool_at).getTime() - new Date(b.entered_pool_at).getTime();

    // Primary-only sort returns 0 for both — no guarantee of order.
    expect(primaryOnly(players[0], players[1])).toBe(0); // <-- ties unresolved
  });
});
