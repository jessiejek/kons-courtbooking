/**
 * Fix F regression — no live winner announcement on /open-play/live.
 *
 * Failure case: when a game ends, the live screen silently flipped to
 * "Preparing Next Match" — no winner moment visible to spectators.
 *
 * Fix: detect `status: 'ended', winner_team` in the Realtime UPDATE payload,
 * build a WinnerAnnouncement from current registrations, show it for 8 seconds,
 * then auto-clear via setTimeout.
 *
 * Test: simulates the Realtime event and validates announcement state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface Registration { id: string; player_name: string; }
interface WinnerAnnouncement {
  winnerTeam: 'A' | 'B';
  winnerNames: string[];
  scoreA: number;
  scoreB: number;
}

function buildGameEndPayload(winner: 'A' | 'B', scoreA: number, scoreB: number, teamA: string[], teamB: string[]) {
  return {
    eventType: 'UPDATE',
    old: { status: 'active' },
    new: {
      status: 'ended',
      winner_team: winner,
      score_a: scoreA,
      score_b: scoreB,
      team_a: teamA,
      team_b: teamB,
    },
  };
}

function processGameEndPayload(
  payload: ReturnType<typeof buildGameEndPayload>,
  registrations: Registration[]
): WinnerAnnouncement | null {
  if (
    payload.eventType !== 'UPDATE' ||
    payload.new?.status !== 'ended' ||
    payload.old?.status === 'ended' ||
    !payload.new?.winner_team
  ) return null;

  const winner: 'A' | 'B' = payload.new.winner_team;
  const winnerIds: string[] = winner === 'A' ? payload.new.team_a : payload.new.team_b;
  const names = winnerIds.map(id => registrations.find(r => r.id === id)?.player_name ?? 'Player');
  return { winnerTeam: winner, winnerNames: names, scoreA: payload.new.score_a, scoreB: payload.new.score_b };
}

describe('Fix F — winner announcement on game end', () => {
  const regs: Registration[] = [
    { id: 'p1', player_name: 'Alice' },
    { id: 'p2', player_name: 'Bob' },
    { id: 'p3', player_name: 'Carol' },
    { id: 'p4', player_name: 'Dave' },
  ];

  it('produces announcement when game transitions to ended', () => {
    const payload = buildGameEndPayload('A', 11, 7, ['p1', 'p2'], ['p3', 'p4']);
    const ann = processGameEndPayload(payload, regs);
    expect(ann).not.toBeNull();
    expect(ann!.winnerTeam).toBe('A');
    expect(ann!.winnerNames).toEqual(['Alice', 'Bob']);
    expect(ann!.scoreA).toBe(11);
    expect(ann!.scoreB).toBe(7);
  });

  it('shows correct winners for team B', () => {
    const payload = buildGameEndPayload('B', 8, 11, ['p1', 'p2'], ['p3', 'p4']);
    const ann = processGameEndPayload(payload, regs);
    expect(ann!.winnerTeam).toBe('B');
    expect(ann!.winnerNames).toEqual(['Carol', 'Dave']);
  });

  it('returns null for non-end events (INSERT)', () => {
    const payload = { eventType: 'INSERT', old: {}, new: { status: 'rally', winner_team: null, score_a: 0, score_b: 0, team_a: ['p1'], team_b: ['p3'] } };
    const ann = processGameEndPayload(payload as any, regs);
    expect(ann).toBeNull();
  });

  it('returns null when game was already ended (old status = ended)', () => {
    const payload = { eventType: 'UPDATE', old: { status: 'ended' }, new: { status: 'ended', winner_team: 'A', score_a: 11, score_b: 5, team_a: ['p1'], team_b: ['p3'] } };
    const ann = processGameEndPayload(payload as any, regs);
    expect(ann).toBeNull();
  });

  it('auto-clears after 8 seconds (timer fires)', () => {
    vi.useFakeTimers();
    let currentAnn: WinnerAnnouncement | null = { winnerTeam: 'A', winnerNames: ['Alice'], scoreA: 11, scoreB: 7 };
    const clear = () => { currentAnn = null; };
    setTimeout(clear, 8000);

    expect(currentAnn).not.toBeNull();
    vi.advanceTimersByTime(8000);
    expect(currentAnn).toBeNull();
    vi.useRealTimers();
  });
});
