/**
 * Tournament bracket logic — double elimination, 10–12 players (5–6 teams).
 *
 * Slot layout: every 2 consecutive seeds = 1 team, every 2 consecutive teams = 1 match.
 * Seeds 1-2 = Team A, Seeds 3-4 = Team B → Match 1 (Team A vs Team B)
 * Seeds 5-6 = Team C, Seeds 7-8 = Team D → Match 2 (Team C vs Team D)
 * Seeds 9-10 = Team E, Seeds 11-12 = Team F → Match 3 (Team E vs Team F, or bye if 10 players)
 */

export interface TPlayer {
  id: string;
  player_name: string;
  skill_tier: 'beginner' | 'intermediate' | 'pro';
  seed: number | null;
  losses: number;
  status: 'active' | 'eliminated';
}

export interface TMatch {
  id: string;
  tournament_id: string;
  bracket: 'winners' | 'losers' | 'grand_final';
  round: number;
  match_number: number;
  team_a_p1: string | null;
  team_a_p2: string | null;
  team_b_p1: string | null;
  team_b_p2: string | null;
  score_a: number;
  score_b: number;
  winner_team: 'A' | 'B' | null;
  status: 'pending' | 'active' | 'completed' | 'bye';
  game_id: string | null;
}

export interface BracketSlot {
  seed: number;       // 1-indexed position
  playerId: string | null;
  playerName: string;
}

// ─── Seeding ─────────────────────────────────────────────────────────────────

/** Assign random seeds to players. Returns slots array (length = next even number >= players). */
export function generateSeeds(players: TPlayer[]): BracketSlot[] {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  // Pad to even count (bye slot)
  const total = shuffled.length % 2 === 0 ? shuffled.length : shuffled.length + 1;
  const slots: BracketSlot[] = Array.from({ length: total }, (_, i) => ({
    seed: i + 1,
    playerId: shuffled[i]?.id ?? null,
    playerName: shuffled[i]?.player_name ?? 'BYE',
  }));
  return slots;
}

/** Swap two slots by seed index (0-based). Returns new slots array. */
export function swapSlots(slots: BracketSlot[], indexA: number, indexB: number): BracketSlot[] {
  const next = [...slots];
  const tmp = { ...next[indexA], seed: next[indexA].seed };
  next[indexA] = { ...next[indexB], seed: next[indexA].seed };
  next[indexB] = { ...tmp, seed: next[indexB].seed };
  return next;
}

/** Re-randomize slots order. Seeds stay positional, players shuffle. */
export function reshuffleSeeds(slots: BracketSlot[]): BracketSlot[] {
  const players = slots.map(s => ({ id: s.playerId, name: s.playerName }))
    .sort(() => Math.random() - 0.5);
  return slots.map((s, i) => ({
    seed: s.seed,
    playerId: players[i].id,
    playerName: players[i].name,
  }));
}

// ─── Round 1 match generation ─────────────────────────────────────────────────

/**
 * From seeded slots, build Round 1 Winners Bracket matches.
 * Slots pair as: [1,2] = Team A, [3,4] = Team B → Match 1; [5,6] Team C, [7,8] Team D → Match 2; etc.
 */
export function buildRound1Matches(
  slots: BracketSlot[],
  tournamentId: string
): Omit<TMatch, 'id'>[] {
  const matches: Omit<TMatch, 'id'>[] = [];
  // Group slots into teams (pairs)
  const teams: BracketSlot[][] = [];
  for (let i = 0; i < slots.length; i += 2) {
    teams.push([slots[i], slots[i + 1]]);
  }
  // Group teams into matches (pairs of teams)
  for (let i = 0; i < teams.length; i += 2) {
    const tA = teams[i];
    const tB = teams[i + 1];
    const isBye = !tB || tB.every(s => !s.playerId);
    matches.push({
      tournament_id: tournamentId,
      bracket: 'winners',
      round: 1,
      match_number: Math.floor(i / 2) + 1,
      team_a_p1: tA[0]?.playerId ?? null,
      team_a_p2: tA[1]?.playerId ?? null,
      team_b_p1: isBye ? null : tB[0]?.playerId ?? null,
      team_b_p2: isBye ? null : tB[1]?.playerId ?? null,
      score_a: 0,
      score_b: 0,
      winner_team: isBye ? 'A' : null,
      status: isBye ? 'bye' : 'pending',
      game_id: null,
    });
  }
  return matches;
}

// ─── Double Elimination advancement ──────────────────────────────────────────

export interface AdvancementResult {
  nextWBMatches: Omit<TMatch, 'id'>[];
  nextLBMatches: Omit<TMatch, 'id'>[];
  grandFinal: Omit<TMatch, 'id'> | null;
}

/**
 * Given completed matches from a round, determine what comes next.
 * wbMatches: completed Winners Bracket matches this round
 * lbMatches: completed Losers Bracket matches this round
 * wbRound: current WB round number
 * lbRound: current LB round number
 */
export function advanceRound(
  tournamentId: string,
  wbCompleted: TMatch[],
  lbCompleted: TMatch[],
  nextWBRound: number,
  nextLBRound: number,
  isWBFinal: boolean,
): AdvancementResult {
  const winners = (m: TMatch) => m.winner_team === 'A'
    ? { p1: m.team_a_p1, p2: m.team_a_p2 }
    : { p1: m.team_b_p1, p2: m.team_b_p2 };
  const losers = (m: TMatch) => m.winner_team === 'A'
    ? { p1: m.team_b_p1, p2: m.team_b_p2 }
    : { p1: m.team_a_p1, p2: m.team_a_p2 };

  const wbWinners = wbCompleted.filter(m => m.status === 'completed').map(winners);
  const wbLosers  = wbCompleted.filter(m => m.status === 'completed' && m.winner_team !== null).map(losers);
  const lbWinners = lbCompleted.filter(m => m.status === 'completed').map(winners);

  // Grand Final: 1 WB winner vs 1 LB winner
  if (isWBFinal && wbWinners.length === 1 && lbWinners.length === 1) {
    return {
      nextWBMatches: [],
      nextLBMatches: [],
      grandFinal: {
        tournament_id: tournamentId,
        bracket: 'grand_final',
        round: nextWBRound,
        match_number: 1,
        team_a_p1: wbWinners[0].p1,
        team_a_p2: wbWinners[0].p2,
        team_b_p1: lbWinners[0].p1,
        team_b_p2: lbWinners[0].p2,
        score_a: 0, score_b: 0,
        winner_team: null,
        status: 'pending',
        game_id: null,
      },
    };
  }

  // Next WB matches: pair up WB winners
  const nextWBMatches: Omit<TMatch, 'id'>[] = [];
  for (let i = 0; i < wbWinners.length; i += 2) {
    const tA = wbWinners[i];
    const tB = wbWinners[i + 1];
    if (!tB) {
      // Bye — tA advances automatically
      nextWBMatches.push({
        tournament_id: tournamentId, bracket: 'winners',
        round: nextWBRound, match_number: Math.floor(i / 2) + 1,
        team_a_p1: tA.p1, team_a_p2: tA.p2,
        team_b_p1: null, team_b_p2: null,
        score_a: 0, score_b: 0,
        winner_team: 'A', status: 'bye', game_id: null,
      });
    } else {
      nextWBMatches.push({
        tournament_id: tournamentId, bracket: 'winners',
        round: nextWBRound, match_number: Math.floor(i / 2) + 1,
        team_a_p1: tA.p1, team_a_p2: tA.p2,
        team_b_p1: tB.p1, team_b_p2: tB.p2,
        score_a: 0, score_b: 0,
        winner_team: null, status: 'pending', game_id: null,
      });
    }
  }

  // Next LB matches: WB losers + LB winners mixed
  const lbPool = [...wbLosers, ...lbWinners];
  const nextLBMatches: Omit<TMatch, 'id'>[] = [];
  for (let i = 0; i < lbPool.length; i += 2) {
    const tA = lbPool[i];
    const tB = lbPool[i + 1];
    if (!tB) {
      nextLBMatches.push({
        tournament_id: tournamentId, bracket: 'losers',
        round: nextLBRound, match_number: Math.floor(i / 2) + 1,
        team_a_p1: tA.p1, team_a_p2: tA.p2,
        team_b_p1: null, team_b_p2: null,
        score_a: 0, score_b: 0,
        winner_team: 'A', status: 'bye', game_id: null,
      });
    } else {
      nextLBMatches.push({
        tournament_id: tournamentId, bracket: 'losers',
        round: nextLBRound, match_number: Math.floor(i / 2) + 1,
        team_a_p1: tA.p1, team_a_p2: tA.p2,
        team_b_p1: tB.p1, team_b_p2: tB.p2,
        score_a: 0, score_b: 0,
        winner_team: null, status: 'pending', game_id: null,
      });
    }
  }

  return { nextWBMatches, nextLBMatches, grandFinal: null };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getTeamName(
  match: TMatch,
  team: 'A' | 'B',
  players: TPlayer[]
): string {
  const find = (id: string | null) => players.find(p => p.id === id)?.player_name ?? '?';
  if (team === 'A') return `${find(match.team_a_p1)} & ${find(match.team_a_p2)}`;
  return `${find(match.team_b_p1)} & ${find(match.team_b_p2)}`;
}

export function isRoundComplete(matches: TMatch[]): boolean {
  return matches.every(m => m.status === 'completed' || m.status === 'bye');
}
