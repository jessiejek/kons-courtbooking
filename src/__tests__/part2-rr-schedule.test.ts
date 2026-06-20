/**
 * Part 2.2 — Round-Robin schedule generation (circle method).
 *
 * Invariants:
 * - N teams (even) → N−1 rounds, N/2 matches/round, (N−1)×(N/2) total non-bye matches
 * - 8 teams → exactly 28 matches, each team appears in exactly 7 matches
 * - N teams (odd) → N rounds, (N−1)/2 real matches/round + 1 bye/round
 * - Each pair plays exactly once across all rounds
 * - BYE matches are flagged isBye: true
 */

import { describe, it, expect } from 'vitest';
import { generateRoundRobinSchedule } from '../lib/openPlayMatchmaking';
import type { RRTeam } from '../lib/openPlayMatchmaking';

function teams(n: number): RRTeam[] {
  return Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}` }));
}

describe('Part 2.2 — Round-Robin schedule generator (circle method)', () => {
  it('8 teams → exactly 28 matches, each team in exactly 7 (no byes)', () => {
    const schedule = generateRoundRobinSchedule(teams(8));
    const realMatches = schedule.filter(m => !m.isBye);
    expect(realMatches.length).toBe(28); // C(8,2) = 28

    const appearances: Record<string, number> = {};
    realMatches.forEach(m => {
      appearances[m.teamA.id] = (appearances[m.teamA.id] ?? 0) + 1;
      appearances[m.teamB!.id] = (appearances[m.teamB!.id] ?? 0) + 1;
    });
    for (const [, count] of Object.entries(appearances)) {
      expect(count).toBe(7); // each team plays 7 times
    }
  });

  it('8 teams → 7 rounds, 4 matches per round', () => {
    const schedule = generateRoundRobinSchedule(teams(8));
    const realMatches = schedule.filter(m => !m.isBye);
    const rounds = new Set(realMatches.map(m => m.round));
    expect(rounds.size).toBe(7);
    for (const r of rounds) {
      expect(realMatches.filter(m => m.round === r).length).toBe(4);
    }
  });

  it('each pair plays exactly once across all rounds', () => {
    const schedule = generateRoundRobinSchedule(teams(8));
    const pairs = new Set<string>();
    schedule.filter(m => !m.isBye).forEach(m => {
      const key = [m.teamA.id, m.teamB!.id].sort().join('|');
      expect(pairs.has(key)).toBe(false); // no duplicate pairs
      pairs.add(key);
    });
    expect(pairs.size).toBe(28);
  });

  it('handles odd N with BYE rounds', () => {
    const schedule = generateRoundRobinSchedule(teams(5));
    const byeMatches = schedule.filter(m => m.isBye);
    const realMatches = schedule.filter(m => !m.isBye);
    expect(byeMatches.length).toBe(5); // 5 rounds, 1 bye each
    expect(realMatches.length).toBe(10); // C(5,2) = 10
  });

  it('handles odd N — each team gets exactly one BYE', () => {
    const schedule = generateRoundRobinSchedule(teams(5));
    const byeTeams = schedule.filter(m => m.isBye).map(m => m.teamA.id);
    const byeSet = new Set(byeTeams);
    expect(byeSet.size).toBe(5); // each team sits out exactly once
  });

  it('2 teams → exactly 1 match', () => {
    const schedule = generateRoundRobinSchedule(teams(2));
    expect(schedule.filter(m => !m.isBye).length).toBe(1);
  });

  it('fewer than 2 teams → empty schedule', () => {
    expect(generateRoundRobinSchedule([])).toEqual([]);
    expect(generateRoundRobinSchedule([{ id: 't1', name: 'T1' }])).toEqual([]);
  });
});
