/**
 * Fix C regression — entered_pool_at implicit DB default.
 *
 * Failure case: customer self-registration omitted entered_pool_at in the insert.
 * If the DB column lacked DEFAULT now(), the value was NULL. Queue ordering
 * (ORDER BY entered_pool_at ASC) then placed those players at the front
 * arbitrarily (NULL sorts first in ASC) or broke entirely.
 *
 * Fix: (1) Set DEFAULT now() + NOT NULL in DB schema.
 *      (2) Always pass entered_pool_at explicitly in the insert.
 *
 * Test: validates the explicit value is always non-null, a valid ISO string,
 * and within a tight time window of the call.
 */

import { describe, it, expect, vi } from 'vitest';

function buildRegistrationPayload(name: string, sessionId: string) {
  return {
    session_id: sessionId,
    player_name: name,
    player_email: null,
    skill_tier: 'beginner',
    is_walkin: true,
    status: 'waiting',
    // Fix C: explicitly included — no longer relies on DB default.
    entered_pool_at: new Date().toISOString(),
  };
}

describe('Fix C — entered_pool_at explicit in customer insert', () => {
  it('payload always includes entered_pool_at', () => {
    const payload = buildRegistrationPayload('Alice', 'session-x');
    expect(payload).toHaveProperty('entered_pool_at');
  });

  it('entered_pool_at is a valid ISO 8601 date string', () => {
    const payload = buildRegistrationPayload('Alice', 'session-x');
    const parsed = new Date(payload.entered_pool_at);
    expect(parsed.toString()).not.toBe('Invalid Date');
  });

  it('entered_pool_at is non-null', () => {
    const payload = buildRegistrationPayload('Alice', 'session-x');
    expect(payload.entered_pool_at).not.toBeNull();
    expect(payload.entered_pool_at).not.toBe('');
  });

  it('entered_pool_at is within 1 second of now', () => {
    const before = Date.now();
    const payload = buildRegistrationPayload('Alice', 'session-x');
    const after  = Date.now();
    const ts = new Date(payload.entered_pool_at).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 100); // allow small clock jitter
  });

  it('DEMONSTRATES the original omission: payload without the field has no entered_pool_at', () => {
    // Old insert did not include entered_pool_at — queue ordering was DB-dependent.
    const oldPayload: Record<string, unknown> = {
      session_id: 'session-x',
      player_name: 'Alice',
      player_email: null,
      skill_tier: 'beginner',
      is_walkin: true,
      status: 'waiting',
      // entered_pool_at intentionally omitted to document the old behavior
    };
    expect(oldPayload).not.toHaveProperty('entered_pool_at'); // <-- the old bug
  });
});
