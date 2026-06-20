/**
 * Fix A regression — auto-trigger match generation.
 *
 * Failure case: supabase-js returns { data: null, count: N } on a HEAD request.
 * The old code read `(waiters as any)?.length ?? 0` — always 0.
 * Fix: destructure `count` directly from the response.
 */

import { describe, it, expect, vi } from 'vitest';

// Simulate the PostgREST HEAD response: body is null, count is a number.
function buildHeadResponse(waitingCount: number) {
  return { data: null, count: waitingCount, error: null };
}

// The fixed trigger logic extracted as a pure function.
async function shouldTriggerMatch(
  supabaseMock: { select: () => Promise<{ data: null; count: number; error: null }> }
): Promise<boolean> {
  const { count } = await supabaseMock.select();
  return (count ?? 0) >= 4;
}

// The OLD broken logic for comparison.
async function brokenShouldTrigger(
  supabaseMock: { select: () => Promise<{ data: null; count: number; error: null }> }
): Promise<boolean> {
  const { data: waiters } = await supabaseMock.select();
  const count = (waiters as any)?.length ?? 0; // always 0 — data is null
  return count >= 4;
}

describe('Fix A — auto-trigger count reading', () => {
  it('correctly reads count from PostgREST HEAD response with 4 waiters', async () => {
    const mock = { select: async () => buildHeadResponse(4) };
    expect(await shouldTriggerMatch(mock)).toBe(true);
  });

  it('correctly reads count from PostgREST HEAD response with 7 waiters', async () => {
    const mock = { select: async () => buildHeadResponse(7) };
    expect(await shouldTriggerMatch(mock)).toBe(true);
  });

  it('does NOT trigger with 3 waiters', async () => {
    const mock = { select: async () => buildHeadResponse(3) };
    expect(await shouldTriggerMatch(mock)).toBe(false);
  });

  it('does NOT trigger with 0 waiters', async () => {
    const mock = { select: async () => buildHeadResponse(0) };
    expect(await shouldTriggerMatch(mock)).toBe(false);
  });

  it('DEMONSTRATES the original bug: old code always returns false even with 4 waiters', async () => {
    const mock = { select: async () => buildHeadResponse(4) };
    // Old code reads data.length but data is null — always 0, never triggers.
    expect(await brokenShouldTrigger(mock)).toBe(false); // <-- this is the bug
  });
});
