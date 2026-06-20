/**
 * Part 2.4 — Standings sort: wins DESC → point differential DESC → points_for DESC.
 *
 * Tests that sortStandings correctly implements the three-level tiebreak.
 */

import { describe, it, expect } from 'vitest';
import { sortStandings } from '../lib/openPlayMatchmaking';

interface Team {
  id: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
}

function t(id: string, wins: number, losses: number, pf: number, pa: number): Team {
  return { id, wins, losses, points_for: pf, points_against: pa };
}

describe('Part 2.4 — sortStandings (wins → diff → points_for)', () => {
  it('primary sort: wins DESC', () => {
    const input = [t('b', 2, 1, 30, 25), t('a', 3, 0, 35, 20), t('c', 1, 2, 20, 30)];
    const result = sortStandings(input);
    expect(result.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('tiebreak 1: point differential DESC when wins equal', () => {
    const input = [
      t('a', 2, 1, 30, 25), // diff = +5
      t('b', 2, 1, 30, 20), // diff = +10 → should rank higher
      t('c', 2, 1, 30, 30), // diff = 0
    ];
    const result = sortStandings(input);
    expect(result[0].id).toBe('b'); // +10 diff
    expect(result[1].id).toBe('a'); // +5 diff
    expect(result[2].id).toBe('c'); // 0 diff
  });

  it('tiebreak 2: points_for DESC when wins and diff equal', () => {
    const input = [
      t('a', 2, 1, 25, 15), // diff = +10, pf = 25
      t('b', 2, 1, 30, 20), // diff = +10, pf = 30 → should rank higher
    ];
    const result = sortStandings(input);
    expect(result[0].id).toBe('b');
    expect(result[1].id).toBe('a');
  });

  it('handles negative point differentials correctly', () => {
    const input = [
      t('a', 1, 2, 15, 30), // diff = -15
      t('b', 1, 2, 20, 25), // diff = -5 → ranks higher despite same wins
    ];
    const result = sortStandings(input);
    expect(result[0].id).toBe('b');
    expect(result[1].id).toBe('a');
  });

  it('does not mutate the input array', () => {
    const input = [t('b', 1, 0, 10, 5), t('a', 2, 0, 20, 10)];
    const original = input.map(t => t.id);
    sortStandings(input);
    expect(input.map(t => t.id)).toEqual(original);
  });

  it('handles empty array', () => {
    expect(sortStandings([])).toEqual([]);
  });

  it('handles single team', () => {
    const team = t('solo', 3, 0, 30, 10);
    expect(sortStandings([team])).toEqual([team]);
  });

  it('8-team standings sort: multiple tiebreaks resolved correctly', () => {
    const input = [
      t('t1', 3, 4, 100, 90),  // diff=+10, pf=100
      t('t2', 5, 2, 110, 80),  // diff=+30
      t('t3', 3, 4, 100, 95),  // diff=+5
      t('t4', 7, 0, 140, 70),  // diff=+70 → 1st
      t('t5', 3, 4, 105, 95),  // diff=+10, pf=105 → beats t1 on pf
      t('t6', 5, 2, 115, 85),  // diff=+30, pf=115 → beats t2 on pf
      t('t7', 0, 7, 50, 130),  // diff=-80 → last
      t('t8', 3, 4, 90, 90),   // diff=0
    ];
    const result = sortStandings(input);
    expect(result[0].id).toBe('t4'); // 7W, diff+70
    expect(result[1].id).toBe('t6'); // 5W, diff+30, pf115
    expect(result[2].id).toBe('t2'); // 5W, diff+30, pf110
    expect(result[result.length - 1].id).toBe('t7'); // 0W
  });
});
