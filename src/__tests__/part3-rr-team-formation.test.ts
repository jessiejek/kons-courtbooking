/**
 * Part 3 — Round-Robin solo registration → system team formation.
 *
 * pairRegistrationsIntoTeams() invariants:
 * - Even count (8) → 4 teams, 0 alternate, each player in exactly one team
 * - Odd count (7)  → 3 teams + 1 alternate, no one silently dropped
 * - Odd count (5)  → 2 teams + 1 alternate
 * - 2 players      → 1 team, no alternate
 * - 4 teams from system pairing → C(4,2) = 6 matches (schedule integration)
 * - No skill filter → works fine (skill_tier falls back gracefully)
 */

import { describe, it, expect } from 'vitest';
import { pairRegistrationsIntoTeams, generateRoundRobinSchedule } from '../lib/openPlayMatchmaking';
import type { SoloRegistrant } from '../lib/openPlayMatchmaking';

function reg(id: string, tier: SoloRegistrant['skill_tier'] = 'beginner'): SoloRegistrant {
  return { id, player_name: `Player-${id}`, skill_tier: tier };
}

function regs(n: number, tier: SoloRegistrant['skill_tier'] = 'beginner'): SoloRegistrant[] {
  return Array.from({ length: n }, (_, i) => reg(`p${i + 1}`, tier));
}

describe('Part 3 — system team formation from solo registrations', () => {
  it('8 players → 4 teams, 0 alternate, every player in exactly one team', () => {
    const { teams, alternate } = pairRegistrationsIntoTeams(regs(8));
    expect(teams.length).toBe(4);
    expect(alternate).toBeNull();
    const allIds = teams.flatMap(t => [t.player1.id, t.player2.id]);
    expect(new Set(allIds).size).toBe(8); // no duplicates
  });

  it('7 players → 3 teams + 1 alternate, no one silently dropped', () => {
    const { teams, alternate } = pairRegistrationsIntoTeams(regs(7));
    expect(teams.length).toBe(3);
    expect(alternate).not.toBeNull();
    const allIds = [...teams.flatMap(t => [t.player1.id, t.player2.id]), alternate!.id];
    expect(new Set(allIds).size).toBe(7);
  });

  it('5 players → 2 teams + 1 alternate', () => {
    const { teams, alternate } = pairRegistrationsIntoTeams(regs(5));
    expect(teams.length).toBe(2);
    expect(alternate).not.toBeNull();
    const allIds = [...teams.flatMap(t => [t.player1.id, t.player2.id]), alternate!.id];
    expect(new Set(allIds).size).toBe(5);
  });

  it('2 players → 1 team, no alternate', () => {
    const { teams, alternate } = pairRegistrationsIntoTeams(regs(2));
    expect(teams.length).toBe(1);
    expect(alternate).toBeNull();
  });

  it('0 players → empty result', () => {
    const { teams, alternate } = pairRegistrationsIntoTeams([]);
    expect(teams).toEqual([]);
    expect(alternate).toBeNull();
  });

  it('4 system-formed teams → C(4,2) = 6 schedule matches', () => {
    const { teams } = pairRegistrationsIntoTeams(regs(8));
    const rrTeams = teams.map((t, i) => ({
      id: `team-${i}`,
      name: `${t.player1.player_name} & ${t.player2.player_name}`,
    }));
    const schedule = generateRoundRobinSchedule(rrTeams);
    const realMatches = schedule.filter(m => !m.isBye);
    expect(realMatches.length).toBe(6); // C(4,2)
  });

  it('works without skill tier (all default to beginner)', () => {
    const players = regs(6, 'beginner');
    const { teams, alternate } = pairRegistrationsIntoTeams(players);
    expect(teams.length).toBe(3);
    expect(alternate).toBeNull();
  });

  it('skillAware mode still produces correct team count', () => {
    const players = [
      reg('a', 'pro'), reg('b', 'intermediate'), reg('c', 'beginner'),
      reg('d', 'pro'), reg('e', 'intermediate'), reg('f', 'beginner'),
    ];
    const { teams, alternate } = pairRegistrationsIntoTeams(players, true);
    expect(teams.length).toBe(3);
    expect(alternate).toBeNull();
    const allIds = teams.flatMap(t => [t.player1.id, t.player2.id]);
    expect(new Set(allIds).size).toBe(6);
  });
});
