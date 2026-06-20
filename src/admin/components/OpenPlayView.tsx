import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Users, ChevronDown, Play, RotateCcw, Trophy, Clock, Shield } from 'lucide-react';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Court { id: number; name: string; }

interface OPSession {
  id: string;
  court_id: number;
  court_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  skill_filter: 'all' | 'beginner' | 'intermediate' | 'pro';
  max_score: number;
  player_cap: number | null;
  status: 'upcoming' | 'active' | 'ended';
  is_recurring: boolean;
  recurrence_rule: 'daily' | 'weekly' | null;
}

interface OPRegistration {
  id: string;
  session_id: string;
  player_name: string;
  player_email: string | null;
  skill_tier: 'beginner' | 'intermediate' | 'pro';
  is_walkin: boolean;
  status: 'waiting' | 'playing' | 'done';
  entered_pool_at: string;
  games_played: number;
  consecutive_wins: number;
}

interface OPGame {
  id: string;
  session_id: string;
  team_a: string[];
  team_b: string[];
  score_a: number;
  score_b: number;
  serving_team: 'A' | 'B' | null;
  server_index: number;
  first_serve_done: boolean;
  status: 'rally' | 'active' | 'ended';
  winner_team: 'A' | 'B' | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  pro: 'bg-amber-100 text-amber-800 border-amber-300',
  intermediate: 'bg-blue-100 text-blue-800 border-blue-300',
  beginner: 'bg-green-100 text-green-800 border-green-300',
};

const TIER_DOT: Record<string, string> = {
  pro: 'bg-amber-400',
  intermediate: 'bg-blue-400',
  beginner: 'bg-green-400',
};

function TierDot({ tier }: { tier: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${TIER_DOT[tier] ?? 'bg-gray-400'} shrink-0`} />;
}

function TierChip({ tier }: { tier: string }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TIER_COLORS[tier] ?? ''} capitalize`}>
      {tier}
    </span>
  );
}

// ─── Smart Matchmaking ────────────────────────────────────────────────────────

function makeMatch(pool: OPRegistration[]): [OPRegistration[], OPRegistration[]] | null {
  if (pool.length < 4) return null;

  const sorted = [...pool].sort((a, b) =>
    new Date(a.entered_pool_at).getTime() - new Date(b.entered_pool_at).getTime()
  );

  const tierOrder = { pro: 3, intermediate: 2, beginner: 1 };
  const pros = sorted.filter(p => p.skill_tier === 'pro');
  const mids = sorted.filter(p => p.skill_tier === 'intermediate');
  const begs = sorted.filter(p => p.skill_tier === 'beginner');

  let teamA: OPRegistration[] = [];
  let teamB: OPRegistration[] = [];

  // Smart balance: 1 strong + 1 weak vs 1 strong + 1 weak
  if (pros.length >= 1 && mids.length >= 1 && begs.length >= 1) {
    teamA = [pros[0], mids[0]];
    teamB = [mids[1] ?? begs[0], begs[1] ?? begs[0]];
    // dedupe
    const used = new Set([teamA[0].id, teamA[1].id, teamB[0].id]);
    const fallback = sorted.find(p => !used.has(p.id));
    if (fallback) teamB[1] = fallback;
  } else if (pros.length >= 2 && mids.length >= 2) {
    teamA = [pros[0], mids[0]];
    teamB = [pros[1], mids[1]];
  } else if (pros.length >= 1 && mids.length >= 1) {
    teamA = [pros[0], sorted.filter(p => !['pro'].includes(p.skill_tier))[0]];
    teamB = [mids[0], sorted.find(p => p.id !== teamA[0].id && p.id !== teamA[1]?.id) ?? sorted[3]];
  } else {
    // Same tier — just take first 4 by wait time
    teamA = [sorted[0], sorted[1]];
    teamB = [sorted[2], sorted[3]];
  }

  // Fallback safety — ensure exactly 2 per team from sorted
  if (teamA.length < 2 || teamB.length < 2 || new Set([...teamA, ...teamB].map(p => p.id)).size < 4) {
    teamA = [sorted[0], sorted[1]];
    teamB = [sorted[2], sorted[3]];
  }

  return [teamA, teamB];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerChip({ reg }: { reg: OPRegistration }) {
  return (
    <div className="flex items-center gap-1.5 bg-white border border-outline-variant/40 rounded-lg px-2 py-1.5 text-xs">
      <TierDot tier={reg.skill_tier} />
      <span className="font-semibold text-on-surface">{reg.player_name}</span>
      {reg.is_walkin && <span className="text-[9px] text-outline">(walk-in)</span>}
    </div>
  );
}

// ─── Scoring Panel ────────────────────────────────────────────────────────────

interface ScoringPanelProps {
  game: OPGame;
  registrations: OPRegistration[];
  maxScore: number;
  onGameEnd: (winnerId: 'A' | 'B', finalScoreA: number, finalScoreB: number) => void;
  onUpdate: (patch: Partial<OPGame>) => void;
}

function ScoringPanel({ game, registrations, maxScore, onGameEnd, onUpdate }: ScoringPanelProps) {
  const [screen, setScreen] = useState<'rally' | 'scoring' | 'over'>(
    game.status === 'rally' ? 'rally' : game.status === 'active' ? 'scoring' : 'over'
  );
  const [sA, setSA] = useState(game.score_a);
  const [sB, setSB] = useState(game.score_b);
  const [servingTeam, setServingTeam] = useState<'A' | 'B'>(game.serving_team ?? 'A');
  const [serverIdx, setServerIdx] = useState(game.server_index ?? 0);
  const [firstServeDone, setFirstServeDone] = useState(game.first_serve_done ?? false);
  const [history, setHistory] = useState<Array<{ sA: number; sB: number; servingTeam: 'A' | 'B'; serverIdx: number; firstServeDone: boolean }>>([]);

  const teamARegs = game.team_a.map(id => registrations.find(r => r.id === id)).filter(Boolean) as OPRegistration[];
  const teamBRegs = game.team_b.map(id => registrations.find(r => r.id === id)).filter(Boolean) as OPRegistration[];

  const serverName = servingTeam === 'A'
    ? teamARegs[serverIdx]?.player_name ?? `Player ${serverIdx + 1}`
    : teamBRegs[serverIdx]?.player_name ?? `Player ${serverIdx + 1}`;

  const getSide = (team: 'A' | 'B') => (team === 'A' ? sA : sB) % 2 === 0 ? 'Right' : 'Left';

  // Pickleball scoring rules:
  // - First to 11 wins, must win by 2
  // - 10-10: keep playing, win by 2 (need 12)
  // - 11-11: keep playing, win by 2 (need 13)
  // - Once someone reaches maxScore (admin cap e.g. 15): they win immediately
  const isDeuce = (a: number, b: number) => a >= 10 && b >= 10;
  const isGameOver = (a: number, b: number) => {
    if (a >= maxScore || b >= maxScore) return true;         // hit the cap → instant win
    if (isDeuce(a, b)) return Math.abs(a - b) >= 2;         // deuce → need 2-point lead
    return (a >= 11 || b >= 11) && Math.abs(a - b) >= 2;   // normal → first to 11, win by 2
  };

  const saveHistory = () =>
    setHistory(h => [...h, { sA, sB, servingTeam, serverIdx, firstServeDone }]);

  const startGame = async (winner: 'A' | 'B') => {
    setServingTeam(winner);
    setServerIdx(0);
    setFirstServeDone(false);
    setScreen('scoring');
    await supabase?.from('open_play_games').update({
      serving_team: winner,
      server_index: 0,
      first_serve_done: false,
      status: 'active',
    }).eq('id', game.id);
  };

  const doPoint = async () => {
    saveHistory();
    let newA = sA, newB = sB;
    if (servingTeam === 'A') newA++; else newB++;
    setSA(newA); setSB(newB);
    await supabase?.from('open_play_games').update({ score_a: newA, score_b: newB }).eq('id', game.id);
    await supabase?.from('open_play_game_events').insert({
      game_id: game.id, event_type: 'point',
      score_a: newA, score_b: newB,
      serving_team: servingTeam, server_index: serverIdx, first_serve_done: firstServeDone,
    });
    if (isGameOver(newA, newB)) setScreen('over');
  };

  const doSideOut = async () => {
    saveHistory();
    let newTeam = servingTeam;
    let newIdx = serverIdx;
    let newFirstDone = firstServeDone;

    if (servingTeam === 'A') {
      if (!firstServeDone && sA === 0 && sB === 0) {
        newTeam = 'B'; newIdx = 0; newFirstDone = true;
      } else if (serverIdx === 0 && !(isDeuce(sA, sB))) {
        newIdx = 1;
      } else {
        newTeam = 'B'; newIdx = 0;
      }
    } else {
      if (serverIdx === 0 && !(isDeuce(sA, sB))) {
        newIdx = 1;
      } else {
        newTeam = 'A'; newIdx = 0;
      }
    }

    setServingTeam(newTeam); setServerIdx(newIdx); setFirstServeDone(newFirstDone);
    await supabase?.from('open_play_games').update({
      serving_team: newTeam, server_index: newIdx, first_serve_done: newFirstDone,
    }).eq('id', game.id);
    await supabase?.from('open_play_game_events').insert({
      game_id: game.id, event_type: 'sideout',
      score_a: sA, score_b: sB,
      serving_team: newTeam, server_index: newIdx, first_serve_done: newFirstDone,
    });
  };

  const doUndo = async () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setSA(prev.sA); setSB(prev.sB);
    setServingTeam(prev.servingTeam); setServerIdx(prev.serverIdx); setFirstServeDone(prev.firstServeDone);
    await supabase?.from('open_play_games').update({
      score_a: prev.sA, score_b: prev.sB,
      serving_team: prev.servingTeam, server_index: prev.serverIdx, first_serve_done: prev.firstServeDone,
    }).eq('id', game.id);
  };

  const confirmGameOver = async () => {
    const winner: 'A' | 'B' = sA > sB ? 'A' : 'B';
    await supabase?.from('open_play_games').update({
      status: 'ended', winner_team: winner,
      score_a: sA, score_b: sB, ended_at: new Date().toISOString(),
    }).eq('id', game.id);
    onGameEnd(winner, sA, sB);
  };

  const TeamSide = ({ team, regs }: { team: 'A' | 'B'; regs: OPRegistration[] }) => {
    const isServing = servingTeam === team;
    const side = getSide(team);
    return (
      <div className={`flex-1 p-3 rounded-xl border ${isServing ? 'bg-green-50 border-primary/30' : 'bg-white border-outline-variant/30'}`}>
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="text-[9px] font-black uppercase tracking-widest text-outline">Team {team}</span>
          {isServing && <span className="text-[9px] font-black bg-primary text-white px-1.5 py-0.5 rounded">SERVING</span>}
        </div>
        {regs.map((r, i) => {
          const isServer = isServing && serverIdx === i;
          return (
            <div key={r.id} className="mb-1.5">
              <div className="flex items-center gap-1.5">
                <TierDot tier={r.skill_tier} />
                <span className={`text-sm font-bold ${isServer ? 'text-primary' : 'text-on-surface'}`}>{r.player_name}</span>
                {isServer && <span className="text-[9px] font-bold text-primary">🏓</span>}
              </div>
              {isServer && (
                <div className="ml-3.5 flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] text-primary font-bold">{side} side</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (screen === 'rally') return (
    <div className="bg-white border border-outline-variant/40 rounded-xl p-4">
      <p className="text-xs font-black uppercase tracking-widest text-outline mb-1">Rally for Serve</p>
      <p className="text-xs text-on-surface-variant mb-4">Play a practice rally — tap who won</p>
      <div className="grid grid-cols-2 gap-3">
        {[{ team: 'A' as const, regs: teamARegs }, { team: 'B' as const, regs: teamBRegs }].map(({ team, regs }) => (
          <button key={team} onClick={() => startGame(team)}
            className="p-3 rounded-xl border-2 border-outline-variant hover:border-primary hover:bg-green-50 transition-all text-left">
            <div className="text-xs font-black text-primary mb-2">Team {team} Wins</div>
            {regs.map(r => (
              <div key={r.id} className="flex items-center gap-1.5 text-xs mb-1">
                <TierDot tier={r.skill_tier} />
                <span className="font-semibold">{r.player_name}</span>
              </div>
            ))}
          </button>
        ))}
      </div>
    </div>
  );

  if (screen === 'over') return (
    <div className="bg-white border-2 border-primary rounded-xl p-5 text-center">
      <div className="text-2xl mb-1">🏆</div>
      <p className="text-lg font-black text-primary mb-1">Game Over!</p>
      <p className="text-3xl font-black text-on-surface mb-2">{sA} – {sB}</p>
      <p className="text-sm font-bold text-on-surface mb-1">
        {(sA > sB ? teamARegs : teamBRegs).map(r => r.player_name).join(' & ')} win!
      </p>
      <p className="text-xs text-on-surface-variant mb-4">
        {(sA > sB ? teamBRegs : teamARegs).map(r => r.player_name).join(' & ')} → back to pool
      </p>
      <button onClick={confirmGameOver}
        className="w-full py-3 bg-primary text-white font-black text-sm rounded-xl">
        ✓ Confirm & Generate Next Match
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Scoreboard */}
      <div className="bg-white border border-outline-variant/40 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_70px_1fr] divide-x divide-outline-variant/20">
          <div className="p-3"><TeamSide team="A" regs={teamARegs} /></div>
          <div className="flex flex-col items-center justify-center py-4 bg-gray-50">
            <div className={`text-4xl font-black leading-none ${sA > sB ? 'text-primary' : 'text-on-surface'}`}>{sA}</div>
            <div className="text-gray-300 text-xl">–</div>
            <div className={`text-4xl font-black leading-none ${sB > sA ? 'text-primary' : 'text-on-surface'}`}>{sB}</div>
            <div className="text-[8px] text-outline mt-2 text-center font-bold">First to 11<br/>Win by 2{isDeuce(sA, sB) ? `\nCap: ${maxScore}` : ''}</div>
          </div>
          <div className="p-3"><TeamSide team="B" regs={teamBRegs} /></div>
        </div>
      </div>

      {/* Status */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 font-semibold text-center">
        🏓 {serverName} is serving · {getSide(servingTeam)} side
        {isDeuce(sA, sB) && <span className="ml-2 font-black text-red-600">· DEUCE {sA}-{sB} — 1 server each, win by 2</span>}
      </div>

      {/* Action buttons */}
      <div className="bg-white border border-outline-variant/40 rounded-xl p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-outline text-center mb-3">What just happened?</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button onClick={doPoint} disabled={isGameOver(sA, sB)}
            className="py-5 bg-primary text-white rounded-xl font-black text-base flex flex-col items-center gap-1 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100">
            ✅ Point
            <span className="text-[10px] font-semibold opacity-80">Serving team scores</span>
          </button>
          <button onClick={doSideOut} disabled={isGameOver(sA, sB)}
            className="py-5 bg-gray-100 text-on-surface rounded-xl font-black text-base flex flex-col items-center gap-1 border border-outline-variant active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100">
            🔄 Side Out
            <span className="text-[10px] font-semibold text-on-surface-variant">Serve changes</span>
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={doUndo} disabled={history.length === 0}
            className="flex-1 py-2 text-xs font-bold text-on-surface-variant border border-outline-variant rounded-lg disabled:opacity-40">
            ↩ Undo
          </button>
          <button onClick={() => setScreen('over')}
            className="flex-1 py-2 text-xs font-bold text-red-500 border border-red-200 rounded-lg">
            End Early
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Session Modal ─────────────────────────────────────────────────────

function CreateSessionModal({ courts, onClose, onCreated }: {
  courts: Court[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [courtId, setCourtId] = useState(courts[0]?.id ?? 1);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('11:00');
  const [skillFilter, setSkillFilter] = useState<OPSession['skill_filter']>('all');
  const [maxScore, setMaxScore] = useState(15);
  const [playerCap, setPlayerCap] = useState<number | ''>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<'daily' | 'weekly'>('weekly');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseEnabled || !supabase) return;
    setSaving(true);
    const { error } = await supabase.from('open_play_sessions').insert({
      court_id: courtId,
      date,
      start_time: startTime,
      end_time: endTime,
      skill_filter: skillFilter,
      max_score: maxScore,
      player_cap: playerCap === '' ? null : Number(playerCap),
      is_recurring: isRecurring,
      recurrence_rule: isRecurring ? recurrenceRule : null,
      status: 'upcoming',
    });
    setSaving(false);
    if (!error) { onCreated(); onClose(); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <h3 className="font-black text-on-surface">New Open Play Session</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-outline hover:bg-surface-container-low"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
          {/* Court */}
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Court</label>
            <select value={courtId} onChange={e => setCourtId(Number(e.target.value))}
              className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0">
              {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0" />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Start</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0" />
            </div>
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">End</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required
                className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0" />
            </div>
          </div>

          {/* Skill Filter */}
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Skill Filter</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['all', 'beginner', 'intermediate', 'pro'] as const).map(f => (
                <button key={f} type="button" onClick={() => setSkillFilter(f)}
                  className={`py-2 rounded-lg text-xs font-bold border capitalize transition-all ${
                    skillFilter === f ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary'
                  }`}>
                  {f === 'intermediate' ? 'Mid' : f}
                </button>
              ))}
            </div>
          </div>

          {/* Max Score + Cap */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Max Score</label>
              <input type="number" min={7} max={21} value={maxScore} onChange={e => setMaxScore(Number(e.target.value))}
                className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0 font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Player Cap</label>
              <input type="number" min={4} value={playerCap} onChange={e => setPlayerCap(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="No limit"
                className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0" />
            </div>
          </div>

          {/* Recurring */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary" />
              <span className="text-sm font-semibold text-on-surface">Recurring session</span>
            </label>
            {isRecurring && (
              <div className="mt-2 flex gap-2">
                {(['daily', 'weekly'] as const).map(r => (
                  <button key={r} type="button" onClick={() => setRecurrenceRule(r)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border capitalize ${
                      recurrenceRule === r ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant'
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 font-bold text-xs text-on-surface-variant border border-outline-variant rounded-xl">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 font-black text-xs bg-primary text-white rounded-xl disabled:opacity-60">
              {saving ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Player Modal ─────────────────────────────────────────────────────────

function AddPlayerModal({ sessionId, onClose, onAdded }: {
  sessionId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<OPRegistration['skill_tier']>('beginner');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !isSupabaseEnabled || !supabase) return;
    setSaving(true);
    await supabase.from('open_play_registrations').insert({
      session_id: sessionId,
      player_name: name.trim(),
      player_email: email.trim() || null,
      skill_tier: tier,
      is_walkin: true,
      status: 'waiting',
      entered_pool_at: new Date().toISOString(),
    });
    setSaving(false);
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <h3 className="font-black text-on-surface">Add Player</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-outline hover:bg-surface-container-low"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Player name"
              className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0" />
          </div>
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Email (optional)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="player@email.com"
              className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0" />
          </div>
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-2">Skill Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {(['beginner', 'intermediate', 'pro'] as const).map(t => (
                <button key={t} type="button" onClick={() => setTier(t)}
                  className={`py-2 rounded-lg text-xs font-bold border capitalize ${
                    tier === t ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant'
                  }`}>
                  {t === 'intermediate' ? 'Mid' : t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 font-bold text-xs text-on-surface-variant border border-outline-variant rounded-xl">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 font-black text-xs bg-primary text-white rounded-xl disabled:opacity-60">
              {saving ? 'Adding…' : 'Add Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function OpenPlayView() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [sessions, setSessions] = useState<OPSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<OPRegistration[]>([]);
  const [activeGame, setActiveGame] = useState<OPGame | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const waitingPool = registrations.filter(r => r.status === 'waiting');
  const playingNow = registrations.filter(r => r.status === 'playing');

  const loadCourts = useCallback(async () => {
    if (!isSupabaseEnabled || !supabase) return;
    const { data } = await supabase.from('courts').select('id, name').order('id');
    if (data) setCourts(data);
  }, []);

  const loadSessions = useCallback(async () => {
    if (!isSupabaseEnabled || !supabase) return;
    const { data } = await supabase
      .from('open_play_sessions')
      .select('*')
      .in('status', ['upcoming', 'active'])
      .order('date', { ascending: true });
    if (data) {
      const enriched = data.map((s: any) => ({
        ...s,
        court_name: courts.find(c => c.id === s.court_id)?.name ?? `Court ${s.court_id}`,
      }));
      setSessions(enriched);
      if (!selectedSessionId && enriched.length > 0) setSelectedSessionId(enriched[0].id);
    }
    setLoading(false);
  }, [courts, selectedSessionId]);

  const loadRegistrations = useCallback(async () => {
    if (!selectedSessionId || !isSupabaseEnabled || !supabase) return;
    const { data } = await supabase
      .from('open_play_registrations')
      .select('*')
      .eq('session_id', selectedSessionId)
      .order('entered_pool_at', { ascending: true });
    if (data) setRegistrations(data);
  }, [selectedSessionId]);

  const loadActiveGame = useCallback(async () => {
    if (!selectedSessionId || !isSupabaseEnabled || !supabase) return;
    const { data } = await supabase
      .from('open_play_games')
      .select('*')
      .eq('session_id', selectedSessionId)
      .in('status', ['rally', 'active'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveGame(data ?? null);
  }, [selectedSessionId]);

  useEffect(() => { loadCourts(); }, [loadCourts]);
  useEffect(() => { loadSessions(); }, [courts]);
  useEffect(() => {
    if (selectedSessionId) {
      loadRegistrations();
      loadActiveGame();
    }
  }, [selectedSessionId]);

  const handleStartSession = async () => {
    if (!selectedSessionId || !isSupabaseEnabled || !supabase) return;
    await supabase.from('open_play_sessions').update({ status: 'active' }).eq('id', selectedSessionId);
    await loadSessions();
    await generateNextMatch();
  };

  const generateNextMatch = async () => {
    if (!selectedSessionId || !isSupabaseEnabled || !supabase) return;

    // Guard: don't create a new game if one is already active
    const { data: existing } = await supabase
      .from('open_play_games')
      .select('id')
      .eq('session_id', selectedSessionId)
      .in('status', ['rally', 'active'])
      .limit(1);
    if (existing && existing.length > 0) { await loadRegistrations(); return; }

    const { data: pool } = await supabase
      .from('open_play_registrations')
      .select('*')
      .eq('session_id', selectedSessionId)
      .eq('status', 'waiting')
      .order('entered_pool_at', { ascending: true });

    if (!pool || pool.length < 4) { await loadRegistrations(); return; }

    const match = makeMatch(pool);
    if (!match) { await loadRegistrations(); return; }

    const [teamA, teamB] = match;
    const { data: game } = await supabase.from('open_play_games').insert({
      session_id: selectedSessionId,
      team_a: teamA.map(p => p.id),
      team_b: teamB.map(p => p.id),
      status: 'rally',
    }).select().single();

    const ids = [...teamA, ...teamB].map(p => p.id);
    await supabase.from('open_play_registrations').update({ status: 'playing' }).in('id', ids);

    await loadRegistrations();
    setActiveGame(game);
  };

  const handleGameEnd = async (winner: 'A' | 'B', _sA: number, _sB: number) => {
    if (!activeGame || !isSupabaseEnabled || !supabase) return;

    const winnerIds = winner === 'A' ? activeGame.team_a : activeGame.team_b;
    const loserIds = winner === 'A' ? activeGame.team_b : activeGame.team_a;

    const now = Date.now();
    // Losers go to pool first (current time) — they wait less next round
    // Winners go to back of pool (now + 1 hour offset) — they just won, others go first
    const loserTime  = new Date(now).toISOString();
    const winnerTime = new Date(now + 60 * 60 * 1000).toISOString();

    for (const id of winnerIds) {
      const reg = registrations.find(r => r.id === id);
      const newWins = (reg?.consecutive_wins ?? 0) + 1;
      const bumped = newWins >= 3;
      await supabase.from('open_play_registrations').update({
        status: 'waiting',
        games_played: (reg?.games_played ?? 0) + 1,
        consecutive_wins: bumped ? 0 : newWins,
        entered_pool_at: winnerTime, // winners go to back
      }).eq('id', id);
    }

    for (const id of loserIds) {
      const reg = registrations.find(r => r.id === id);
      await supabase.from('open_play_registrations').update({
        status: 'waiting',
        games_played: (reg?.games_played ?? 0) + 1,
        consecutive_wins: 0,
        entered_pool_at: loserTime, // losers go ahead of winners
      }).eq('id', id);
    }

    setActiveGame(null);
    await loadRegistrations();
    await generateNextMatch();
  };

  const handleEndSession = async () => {
    if (!selectedSessionId || !isSupabaseEnabled || !supabase) return;
    await supabase.from('open_play_sessions').update({ status: 'ended' }).eq('id', selectedSessionId);
    await loadSessions();
  };

  // Leaderboard
  const leaderboard = [...registrations]
    .filter(r => r.games_played > 0)
    .sort((a, b) => b.consecutive_wins - a.consecutive_wins || b.games_played - a.games_played)
    .slice(0, 5);

  if (loading) return (
    <div className="text-center py-12 text-sm text-on-surface-variant animate-pulse">Loading Open Play…</div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">Open Play</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Manage live sessions, matchmaking &amp; scoring</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> New Session
        </button>
      </div>

      {/* No sessions */}
      {sessions.length === 0 && (
        <div className="text-center py-16 bg-white border border-outline-variant/40 rounded-2xl">
          <div className="text-4xl mb-3">🏓</div>
          <p className="font-bold text-on-surface mb-1">No active sessions</p>
          <p className="text-sm text-on-surface-variant mb-4">Create an Open Play session to get started</p>
          <button onClick={() => setShowCreate(true)}
            className="bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-xl">
            Create Session
          </button>
        </div>
      )}

      {sessions.length > 0 && (
        <>
          {/* Session selector */}
          <div className="flex gap-2 flex-wrap">
            {sessions.map(s => (
              <button key={s.id} onClick={() => setSelectedSessionId(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                  selectedSessionId === s.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-on-surface-variant border-outline-variant hover:border-primary'
                }`}>
                <span>{s.court_name}</span>
                <span className="opacity-70">{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</span>
                {s.status === 'active' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {selectedSession && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* LEFT: Pool + Controls */}
              <div className="lg:col-span-1 space-y-4">
                {/* Session info */}
                <div className="bg-white border border-outline-variant/40 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-black text-on-surface">{selectedSession.court_name}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {selectedSession.date} · {selectedSession.start_time.slice(0,5)}–{selectedSession.end_time.slice(0,5)}
                      </p>
                    </div>
                    <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                      selectedSession.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedSession.status}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <TierChip tier={selectedSession.skill_filter === 'all' ? 'all levels' : selectedSession.skill_filter} />
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-outline-variant/60 text-outline">
                      First to {selectedSession.max_score}
                    </span>
                    {selectedSession.player_cap && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-outline-variant/60 text-outline">
                        Cap: {selectedSession.player_cap}
                      </span>
                    )}
                  </div>

                  {selectedSession.status === 'upcoming' && (
                    <button onClick={handleStartSession}
                      className="w-full mt-3 py-2.5 bg-primary text-white text-xs font-black rounded-xl flex items-center justify-center gap-2">
                      <Play className="w-3.5 h-3.5" /> Start Session
                    </button>
                  )}
                  {selectedSession.status === 'active' && (
                    <button onClick={handleEndSession}
                      className="w-full mt-3 py-2.5 bg-red-50 text-red-600 border border-red-200 text-xs font-black rounded-xl">
                      End Session
                    </button>
                  )}
                </div>

                {/* Waiting Pool */}
                <div className="bg-white border border-outline-variant/40 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-outline" />
                      <span className="text-xs font-black uppercase tracking-widest text-outline">Waiting Pool</span>
                      <span className="text-xs font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{waitingPool.length}</span>
                    </div>
                    <button onClick={() => setShowAddPlayer(true)}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/5 px-2 py-1 rounded-lg">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  {waitingPool.length === 0 ? (
                    <p className="text-xs text-on-surface-variant text-center py-4">No players waiting</p>
                  ) : (
                    <div className="space-y-2">
                      {waitingPool.map((r, i) => (
                        <div key={r.id} className="flex items-center justify-between bg-surface-container-low/40 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-outline w-4">#{i + 1}</span>
                            <TierDot tier={r.skill_tier} />
                            <span className="text-sm font-semibold text-on-surface">{r.player_name}</span>
                            {r.is_walkin && <span className="text-[9px] text-outline">walk-in</span>}
                          </div>
                          <TierChip tier={r.skill_tier} />
                        </div>
                      ))}
                    </div>
                  )}

                  {waitingPool.length < 4 && selectedSession.status === 'active' && (
                    <p className="text-[10px] text-amber-600 font-bold mt-2 text-center">
                      Need {4 - waitingPool.length} more player{4 - waitingPool.length !== 1 ? 's' : ''} for next match
                    </p>
                  )}
                </div>

                {/* Leaderboard */}
                {leaderboard.length > 0 && (
                  <div className="bg-white border border-outline-variant/40 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-black uppercase tracking-widest text-outline">Today's Leaders</span>
                    </div>
                    <div className="space-y-2">
                      {leaderboard.map((r, i) => (
                        <div key={r.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-outline w-4">{i + 1}</span>
                            <TierDot tier={r.skill_tier} />
                            <span className="text-sm font-semibold text-on-surface">{r.player_name}</span>
                          </div>
                          <span className="text-xs font-bold text-primary">{r.games_played}G · {r.consecutive_wins}W</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Active Game / Scoring */}
              <div className="lg:col-span-2 space-y-4">
                {activeGame ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-widest text-outline">Live Game</span>
                    </div>
                    <ScoringPanel
                      game={activeGame}
                      registrations={registrations}
                      maxScore={selectedSession.max_score}
                      onGameEnd={handleGameEnd}
                      onUpdate={() => loadActiveGame()}
                    />
                  </>
                ) : (
                  <div className="bg-white border border-outline-variant/40 rounded-2xl p-8 text-center">
                    {selectedSession.status === 'upcoming' ? (
                      <>
                        <div className="text-3xl mb-3">🏓</div>
                        <p className="font-bold text-on-surface mb-1">Session not started</p>
                        <p className="text-sm text-on-surface-variant mb-4">Add players then tap Start Session</p>
                      </>
                    ) : waitingPool.length >= 4 ? (
                      <>
                        <div className="text-3xl mb-3">⚡</div>
                        <p className="font-bold text-on-surface mb-1">Ready to match!</p>
                        <p className="text-sm text-on-surface-variant mb-4">{waitingPool.length} players waiting</p>
                        <button onClick={generateNextMatch}
                          className="bg-primary text-white text-sm font-black px-6 py-3 rounded-xl">
                          Generate Next Match
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl mb-3">⏳</div>
                        <p className="font-bold text-on-surface mb-1">Waiting for players</p>
                        <p className="text-sm text-on-surface-variant">
                          Need at least 4 players in the pool
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Playing now */}
                {playingNow.length > 0 && (
                  <div className="bg-white border border-outline-variant/40 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-primary" />
                      <span className="text-xs font-black uppercase tracking-widest text-outline">On Court Now</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {playingNow.map(r => <PlayerChip key={r.id} reg={r} />)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateSessionModal courts={courts} onClose={() => setShowCreate(false)} onCreated={() => { loadSessions(); }} />
      )}
      {showAddPlayer && selectedSessionId && (
        <AddPlayerModal sessionId={selectedSessionId} onClose={() => setShowAddPlayer(false)} onAdded={loadRegistrations} />
      )}
    </div>
  );
}
