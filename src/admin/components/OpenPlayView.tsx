import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useToast, ToastContainer } from '../../components/Toast';
import { Plus, X, Users, Play, Trophy, Clock, Shield, CheckCircle } from 'lucide-react';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import {
  makeMatch, PLAYERS_PER_MATCH, generateRoundRobinSchedule, sortStandings, pairRegistrationsIntoTeams,
} from '../../lib/openPlayMatchmaking';
import type { BalanceMode, RRTeam } from '../../lib/openPlayMatchmaking';

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
  skill_balance_mode: 'arrival_order' | 'skill_aware';
  session_type: 'rotation' | 'round_robin';
}

interface OPRegistration {
  id: string;
  session_id: string;
  player_name: string;
  player_email: string | null;
  skill_tier: 'beginner' | 'intermediate' | 'pro';
  is_walkin: boolean;
  is_present: boolean;
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
  rr_match_id?: string | null;
  rr_team_a_id?: string | null;
  rr_team_b_id?: string | null;
  rr_team_a_name?: string | null;
  rr_team_b_name?: string | null;
}

interface OPTeam {
  id: string;
  session_id: string;
  player1_name: string;
  player2_name: string;
  player1_tier?: string | null;
  player2_tier?: string | null;
  email: string | null;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
}

interface OPRRMatch {
  id: string;
  session_id: string;
  team_a_id: string;
  team_b_id: string | null;
  round_number: number;
  status: 'pending' | 'active' | 'ended' | 'bye';
  score_a: number | null;
  score_b: number | null;
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

// ─── Scoring Panel ────────────────────────────────────────────────────────────

interface ScoringPanelProps {
  game: OPGame;
  registrations: OPRegistration[];
  maxScore: number;
  onGameEnd: (winnerId: 'A' | 'B', finalScoreA: number, finalScoreB: number) => void;
  onUpdate: (patch: Partial<OPGame>) => void;
  /** When set: display uses team name strings instead of player lookups; champion check skipped. */
  rrMode?: { teamA: string; teamB: string };
}

function ScoringPanel({ game, registrations, maxScore, onGameEnd, onUpdate, rrMode }: ScoringPanelProps) {
  const [screen, setScreen] = useState<'rally' | 'scoring' | 'over' | 'champion'>(
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

  const serverName = rrMode
    ? `Team ${servingTeam}`
    : (servingTeam === 'A'
        ? teamARegs[serverIdx]?.player_name ?? `Player ${serverIdx + 1}`
        : teamBRegs[serverIdx]?.player_name ?? `Player ${serverIdx + 1}`);

  const getSide = (team: 'A' | 'B') => (team === 'A' ? sA : sB) % 2 === 0 ? 'Right' : 'Left';

  const isDeuce = (a: number, b: number) => a >= 10 && b >= 10;
  const isGameOver = (a: number, b: number) => {
    if (a >= maxScore || b >= maxScore) return true;
    if (isDeuce(a, b)) return Math.abs(a - b) >= 2;
    return (a >= 11 || b >= 11) && Math.abs(a - b) >= 2;
  };

  // Compute who serves next (mirrors doSideOut logic, read-only)
  const nextServer = (() => {
    let nTeam = servingTeam;
    let nIdx = serverIdx;
    if (servingTeam === 'A') {
      if (serverIdx === 0 && !isDeuce(sA, sB)) { nIdx = 1; }
      else { nTeam = 'B'; nIdx = 0; }
    } else {
      if (serverIdx === 0 && !isDeuce(sA, sB)) { nIdx = 1; }
      else { nTeam = 'A'; nIdx = 0; }
    }
    if (rrMode) return `Team ${nTeam} serves`;
    const regs = nTeam === 'A' ? teamARegs : teamBRegs;
    return regs[nIdx]?.player_name ?? `Player ${nIdx + 1}`;
  })();

  const saveHistory = () =>
    setHistory(h => [...h, { sA, sB, servingTeam, serverIdx, firstServeDone }]);

  const startGame = async (winner: 'A' | 'B') => {
    setServingTeam(winner);
    setServerIdx(0);
    setFirstServeDone(false);
    setScreen('scoring');
    await supabase?.from('open_play_games').update({
      serving_team: winner, server_index: 0, first_serve_done: false, status: 'active',
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
      if (serverIdx === 0 && !(isDeuce(sA, sB))) {
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
    // Fix J: open_play_game_events is an append-only audit log; undo does not modify it.
  };

  const confirmGameOver = async () => {
    const winner: 'A' | 'B' = sA > sB ? 'A' : 'B';
    await supabase?.from('open_play_games').update({
      status: 'ended', winner_team: winner,
      score_a: sA, score_b: sB, ended_at: new Date().toISOString(),
    }).eq('id', game.id);
    if (!rrMode) {
      // DELIBERATE TEAM ACHIEVEMENT — do not change to per-player check.
      // Champion fires when ALL members of the winning team independently carry
      // 2+ consecutive wins (i.e. this is their 3rd win in a row together).
      // Both behaviors are intended. The check reads pre-increment state (2 in DB
      // = 3rd win about to be awarded), so >= 2 is correct.
      const winnerRegs = winner === 'A' ? teamARegs : teamBRegs;
      const isChampion = winnerRegs.every(r => r.consecutive_wins >= 2);
      if (isChampion) { setScreen('champion'); return; }
    }
    onGameEnd(winner, sA, sB);
  };

  const TeamSide = ({ team, regs }: { team: 'A' | 'B'; regs: OPRegistration[] }) => {
    const isServing = servingTeam === team;
    const side = getSide(team);
    // Split team name string into individual player names for RR mode
    const teamLabel = rrMode ? (team === 'A' ? rrMode.teamA : rrMode.teamB) : null;
    const playerNames: string[] = regs.length > 0
      ? regs.map(r => r.player_name)
      : teamLabel ? teamLabel.split(' & ') : [];
    return (
      <div className={`rounded-xl border ${isServing ? 'bg-green-50 border-primary/30' : 'bg-white border-outline-variant/30'} p-3`}>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-outline">Team {team}</span>
        </div>
        {playerNames.map((name, i) => {
          const isServer = isServing && serverIdx === i;
          const r = regs[i];
          return (
            <div key={i} className={`flex items-center justify-between rounded-lg px-2 py-1.5 mb-1 ${isServer ? 'bg-primary/10' : ''}`}>
              <div className="flex items-center gap-2">
                {r && <TierDot tier={r.skill_tier} />}
                <span className={`text-sm font-bold leading-tight ${isServer ? 'text-primary' : 'text-on-surface'}`}>{name}</span>
              </div>
              {isServer
                ? <span className="text-[9px] font-black bg-primary text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">SERVING · {side}</span>
                : <span className="text-[9px] text-outline font-medium">–</span>
              }
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
        {(['A', 'B'] as const).map((team) => {
          const regs = team === 'A' ? teamARegs : teamBRegs;
          const label = rrMode ? (team === 'A' ? rrMode.teamA : rrMode.teamB) : null;
          return (
            <button key={team} onClick={() => startGame(team)}
              className="p-3 rounded-xl border-2 border-outline-variant hover:border-primary hover:bg-green-50 transition-all text-left">
              <div className="text-xs font-black text-primary mb-2">Team {team} Wins</div>
              {label ? (
                <p className="text-sm font-semibold">{label}</p>
              ) : (
                regs.map(r => (
                  <div key={r.id} className="flex items-center gap-1.5 text-xs mb-1">
                    <TierDot tier={r.skill_tier} />
                    <span className="font-semibold">{r.player_name}</span>
                  </div>
                ))
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (screen === 'champion') {
    const champRegs = sA > sB ? teamARegs : teamBRegs;
    const loserRegs = sA > sB ? teamBRegs : teamARegs;
    return (
      <div className="bg-gradient-to-b from-amber-50 to-white border-2 border-amber-400 rounded-xl p-6 text-center">
        <div className="text-4xl mb-2 animate-bounce">🏆</div>
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">3 Consecutive Wins!</p>
        <p className="text-2xl font-black text-amber-600 mb-2">ROTATION CHAMPION</p>
        <div className="bg-amber-100 rounded-xl p-3 mb-3">
          {champRegs.map(r => (
            <div key={r.id} className="flex items-center justify-center gap-2 mb-1">
              <TierDot tier={r.skill_tier} />
              <span className="font-black text-base text-amber-800">{r.player_name}</span>
            </div>
          ))}
        </div>
        <p className="text-3xl font-black text-on-surface mb-1">{sA} – {sB}</p>
        <p className="text-xs text-on-surface-variant mb-4">
          Streak resets · {loserRegs.map(r => r.player_name).join(' & ')} → back to pool
        </p>
        <button
          onClick={() => onGameEnd(sA > sB ? 'A' : 'B', sA, sB)}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-xl transition-colors">
          🎉 Celebrate & Continue Session →
        </button>
      </div>
    );
  }

  if (screen === 'over') return (
    <div className="bg-white border-2 border-primary rounded-xl p-5 text-center">
      <div className="text-2xl mb-1">🏅</div>
      <p className="text-lg font-black text-primary mb-1">Game Over!</p>
      <p className="text-3xl font-black text-on-surface mb-2">{sA} – {sB}</p>
      <p className="text-sm font-bold text-on-surface mb-1">
        {rrMode
          ? `${sA > sB ? rrMode.teamA : rrMode.teamB} win!`
          : (sA > sB ? teamARegs : teamBRegs).map(r => r.player_name).join(' & ') + ' win!'
        }
      </p>
      {!rrMode && (
        <p className="text-xs text-on-surface-variant mb-4">
          {(sA > sB ? teamBRegs : teamARegs).map(r => r.player_name).join(' & ')} → back to pool
        </p>
      )}
      <button onClick={confirmGameOver}
        className="w-full py-3 bg-primary text-white font-black text-sm rounded-xl mt-2">
        ✓ Confirm & {rrMode ? 'Next Match' : 'Generate Next Match'}
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
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

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 font-semibold text-center">
        🏓 {serverName} is serving · {getSide(servingTeam)} side
        {isDeuce(sA, sB) && <span className="ml-2 font-black text-red-600">· DEUCE {sA}-{sB} — 1 server each, win by 2</span>}
      </div>

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
            <span className="text-[10px] font-semibold text-on-surface-variant">→ {nextServer} serves</span>
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
  const [sessionType, setSessionType] = useState<'rotation' | 'round_robin'>('rotation');
  const [skillFilter, setSkillFilter] = useState<OPSession['skill_filter']>('all');
  const [maxScore, setMaxScore] = useState(15);
  const [playerCap, setPlayerCap] = useState<number | ''>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<'daily' | 'weekly'>('weekly');
  const [skillBalanceMode, setSkillBalanceMode] = useState<'arrival_order' | 'skill_aware'>('arrival_order');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSupabaseEnabled || !supabase) return;
    setSaving(true);
    const { error } = await supabase.from('open_play_sessions').insert({
      court_id: courtId,
      date,
      start_time: startTime,
      end_time: endTime,
      session_type: sessionType,
      skill_filter: skillFilter,
      max_score: maxScore,
      player_cap: playerCap === '' ? null : Number(playerCap),
      is_recurring: isRecurring,
      recurrence_rule: isRecurring ? recurrenceRule : null,
      skill_balance_mode: sessionType === 'round_robin' ? 'arrival_order' : skillBalanceMode,
      status: 'upcoming',
    });
    setSaving(false);
    if (!error) { onCreated(); onClose(); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <h3 className="font-black text-on-surface">New Open Play Session</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-outline hover:bg-surface-container-low"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
          {/* Session Format */}
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Format</label>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { value: 'rotation' as const, label: 'Rotation', desc: 'Open pool, continuous play' },
                { value: 'round_robin' as const, label: 'Round-Robin', desc: 'Players register solo — teams randomly formed at start' },
              ]).map(f => (
                <button key={f.value} type="button" onClick={() => setSessionType(f.value)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-left ${
                    sessionType === f.value ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary'
                  }`}>
                  <div>{f.label}</div>
                  <div className={`text-[10px] font-normal mt-0.5 ${sessionType === f.value ? 'text-white/70' : 'text-outline'}`}>{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

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

          {/* Skill Filter — shown for both formats */}
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

          {/* Matching Mode — rotation only (RR pairing is always random) */}
          {sessionType === 'rotation' && (
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Matching Mode</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { value: 'arrival_order' as const, label: 'Arrival Order', desc: 'First-come, first-matched' },
                  { value: 'skill_aware' as const, label: 'Skill Aware', desc: 'Balance by skill tier' },
                ]).map(m => (
                  <button key={m.value} type="button" onClick={() => setSkillBalanceMode(m.value)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-left ${
                      skillBalanceMode === m.value ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary'
                    }`}>
                    <div>{m.label}</div>
                    <div className={`text-[10px] font-normal mt-0.5 ${skillBalanceMode === m.value ? 'text-white/70' : 'text-outline'}`}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Max Score + Cap */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Max Score</label>
              <input type="number" min={7} max={21} value={maxScore} onChange={e => setMaxScore(Number(e.target.value))}
                className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0 font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">
                {sessionType === 'round_robin' ? 'Team Cap' : 'Player Cap'}
              </label>
              <input type="number" min={2} value={playerCap} onChange={e => setPlayerCap(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="No limit"
                className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0" />
            </div>
          </div>

          {/* Recurring (rotation only) */}
          {sessionType === 'rotation' && (
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
          )}

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

// ─── Edit Session Modal ───────────────────────────────────────────────────────

function EditSessionModal({ session, onClose, onSaved }: {
  session: OPSession;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isActive = session.status === 'active';
  const isRR = session.session_type === 'round_robin';

  const [date, setDate]               = useState(session.date);
  const [startTime, setStartTime]     = useState(session.start_time.slice(0, 5));
  const [endTime, setEndTime]         = useState(session.end_time.slice(0, 5));
  const [skillFilter, setSkillFilter] = useState<OPSession['skill_filter']>(session.skill_filter);
  const [maxScore, setMaxScore]       = useState(session.max_score);
  const [playerCap, setPlayerCap]     = useState<number | ''>(session.player_cap ?? '');
  const [skillBalanceMode, setSkillBalanceMode] = useState<OPSession['skill_balance_mode']>(session.skill_balance_mode);
  const [saving, setSaving]           = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSupabaseEnabled || !supabase) return;
    setSaving(true);

    const patch = isActive
      ? { max_score: maxScore, player_cap: playerCap === '' ? null : Number(playerCap), skill_balance_mode: skillBalanceMode }
      : {
          date, start_time: startTime, end_time: endTime,
          ...(isRR ? {} : { skill_filter: skillFilter, skill_balance_mode: skillBalanceMode }),
          max_score: maxScore, player_cap: playerCap === '' ? null : Number(playerCap),
        };

    await supabase.from('open_play_sessions').update(patch).eq('id', session.id);
    setSaving(false);
    onSaved();
    onClose();
  };

  const inputCls = 'w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0';
  const disabledInputCls = `${inputCls} bg-surface-container-low text-outline cursor-not-allowed opacity-60`;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <div>
            <h3 className="font-black text-on-surface">Edit Session</h3>
            <p className="text-[10px] text-outline mt-0.5 capitalize">{session.session_type === 'round_robin' ? 'Round-Robin' : 'Rotation'}</p>
            {isActive && <p className="text-[10px] text-amber-600 font-bold mt-0.5">Session is live — some fields locked</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-outline hover:bg-surface-container-low"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isActive}
              className={isActive ? disabledInputCls : inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Start</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={isActive}
                className={isActive ? disabledInputCls : inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">End</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={isActive}
                className={isActive ? disabledInputCls : inputCls} />
            </div>
          </div>

          {/* session_type is always locked after creation */}
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Format (locked)</label>
            <div className={`${disabledInputCls} capitalize`}>
              {session.session_type === 'round_robin' ? 'Round-Robin' : 'Rotation'}
            </div>
          </div>

          {!isRR && (
            <>
              <div>
                <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Skill Filter</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['all', 'beginner', 'intermediate', 'pro'] as const).map(f => (
                    <button key={f} type="button" onClick={() => !isActive && setSkillFilter(f)} disabled={isActive}
                      className={`py-2 rounded-lg text-xs font-bold border capitalize transition-all ${
                        skillFilter === f ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant'
                      } ${isActive ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'}`}>
                      {f === 'intermediate' ? 'Mid' : f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Matching Mode</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { value: 'arrival_order' as const, label: 'Arrival Order', desc: 'First-come, first-matched' },
                    { value: 'skill_aware' as const, label: 'Skill Aware', desc: 'Balance by skill tier' },
                  ]).map(m => (
                    <button key={m.value} type="button" onClick={() => setSkillBalanceMode(m.value)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-left ${
                        skillBalanceMode === m.value ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary'
                      }`}>
                      <div>{m.label}</div>
                      <div className={`text-[10px] font-normal mt-0.5 ${skillBalanceMode === m.value ? 'text-white/70' : 'text-outline'}`}>{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Max Score</label>
              <input type="number" min={7} max={21} value={maxScore} onChange={e => setMaxScore(Number(e.target.value))}
                className={`${inputCls} font-bold`} />
            </div>
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">
                {isRR ? 'Team Cap' : 'Player Cap'}
              </label>
              <input type="number" min={2} value={playerCap} onChange={e => setPlayerCap(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="No limit" className={inputCls} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 font-bold text-xs text-on-surface-variant border border-outline-variant rounded-xl">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 font-black text-xs bg-primary text-white rounded-xl disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Player Modal (Rotation) ──────────────────────────────────────────────

function AddPlayerModal({ sessionId, onClose, onAdded }: {
  sessionId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<OPRegistration['skill_tier']>('beginner');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !isSupabaseEnabled || !supabase) return;
    setSaving(true);
    await supabase.from('open_play_registrations').insert({
      session_id: sessionId,
      player_name: name.trim(),
      player_email: email.trim() || null,
      skill_tier: tier,
      is_walkin: true,
      is_present: true, // Fix I: admin adds players at the court — always present
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

// ─── Add Team Modal (Round-Robin) ─────────────────────────────────────────────

function AddTeamModal({ sessionId, existingTeam, onClose, onSaved }: {
  sessionId: string;
  existingTeam?: OPTeam;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [p1, setP1] = useState(existingTeam?.player1_name ?? '');
  const [p2, setP2] = useState(existingTeam?.player2_name ?? '');
  const [email, setEmail] = useState(existingTeam?.email ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!p1.trim() || !p2.trim() || !supabase) return;
    setSaving(true);
    if (existingTeam) {
      await supabase.from('open_play_teams').update({
        player1_name: p1.trim(), player2_name: p2.trim(), email: email.trim() || null,
      }).eq('id', existingTeam.id);
    } else {
      await supabase.from('open_play_teams').insert({
        session_id: sessionId,
        player1_name: p1.trim(), player2_name: p2.trim(), email: email.trim() || null,
      });
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <h3 className="font-black text-on-surface">{existingTeam ? 'Edit Team' : 'Add Team'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-outline hover:bg-surface-container-low"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Player 1</label>
            <input value={p1} onChange={e => setP1(e.target.value)} required placeholder="Player 1 name"
              className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0" />
          </div>
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Player 2</label>
            <input value={p2} onChange={e => setP2(e.target.value)} required placeholder="Player 2 name"
              className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0" />
          </div>
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-1">Team email (optional)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@email.com"
              className="w-full border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 font-bold text-xs text-on-surface-variant border border-outline-variant rounded-xl">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 font-black text-xs bg-primary text-white rounded-xl disabled:opacity-60">
              {saving ? 'Saving…' : existingTeam ? 'Save' : 'Add Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Session End Standings Modal (Rotation) ───────────────────────────────────

function RotationEndStandingsModal({ registrations, onConfirmEnd }: {
  registrations: OPRegistration[];
  onConfirmEnd: () => void;
}) {
  const standings = [...registrations]
    .filter(r => r.games_played > 0)
    .sort((a, b) => b.consecutive_wins - a.consecutive_wins || b.games_played - a.games_played);

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-primary px-5 py-4 text-white">
          <div className="text-3xl mb-1">🏆</div>
          <h3 className="font-black text-lg">Session Standings</h3>
          <p className="text-xs text-white/70">End of Rotation session</p>
        </div>
        <div className="p-5">
          {standings.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-4">No games played yet</p>
          ) : (
            <div className="space-y-2 mb-5">
              {standings.slice(0, 8).map((r, i) => (
                <div key={r.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black w-5 ${i === 0 ? 'text-amber-500' : 'text-outline'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </span>
                    <TierDot tier={r.skill_tier} />
                    <span className="text-sm font-semibold text-on-surface">{r.player_name}</span>
                  </div>
                  <span className="text-xs font-bold text-primary">{r.games_played}G · {r.consecutive_wins}W streak</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={onConfirmEnd}
            className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-black text-sm rounded-xl transition-colors">
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RR Champion Modal ────────────────────────────────────────────────────────

function RRChampionModal({ teams, onClose }: {
  teams: OPTeam[];
  onClose: () => void;
}) {
  const standings: OPTeam[] = sortStandings(teams);
  const champ = standings[0];

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-b from-amber-400 to-amber-500 px-5 py-6 text-white text-center">
          <div className="text-5xl mb-2 animate-bounce">🏆</div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1">Round-Robin Complete</p>
          <p className="text-2xl font-black">CHAMPION</p>
          {champ && <p className="text-xl font-bold mt-2">{champ.player1_name} & {champ.player2_name}</p>}
          {champ && <p className="text-xs text-white/80 mt-1">{champ.wins}W – {champ.losses}L</p>}
        </div>
        <div className="p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-outline mb-3">Final Standings</p>
          <div className="space-y-2 mb-5">
            {standings.map((t, i) => {
              const diff = t.points_for - t.points_against;
              return (
                <div key={t.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-outline w-4">{i + 1}</span>
                    <span className="text-sm font-semibold text-on-surface">{t.player1_name} & {t.player2_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-primary">{t.wins}W–{t.losses}L</span>
                    <span className={`text-[10px] font-bold ml-1 ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      ({diff >= 0 ? '+' : ''}{diff})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={onClose}
            className="w-full py-3 bg-primary text-white font-black text-sm rounded-xl">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function OpenPlayView() {
  const { toasts, toast, removeToast } = useToast();
  const [courts, setCourts] = useState<Court[]>([]);
  const [sessions, setSessions] = useState<OPSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<OPRegistration[]>([]);
  const [activeGame, setActiveGame] = useState<OPGame | null>(null);
  const [rrTeams, setRRTeams] = useState<OPTeam[]>([]);
  const [rrMatches, setRRMatches] = useState<OPRRMatch[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEndStandings, setShowEndStandings] = useState(false);
  const [showRRChampion, setShowRRChampion] = useState(false);
  const [editTeam, setEditTeam] = useState<OPTeam | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const isRR = selectedSession?.session_type === 'round_robin';
  const waitingPool = registrations.filter(r => r.status === 'waiting' && r.is_present);
  const notCheckedIn = registrations.filter(r => r.status === 'waiting' && !r.is_present);
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
      .order('entered_pool_at', { ascending: true })
      .order('id', { ascending: true }); // Fix D: deterministic secondary sort for tied timestamps
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

  const loadRRData = useCallback(async () => {
    if (!selectedSessionId || !isSupabaseEnabled || !supabase) return;
    const [{ data: teams }, { data: matches }] = await Promise.all([
      supabase.from('open_play_teams').select('*').eq('session_id', selectedSessionId).order('created_at'),
      supabase.from('open_play_rr_matches').select('*').eq('session_id', selectedSessionId).order('round_number').order('id'),
    ]);
    if (teams) setRRTeams(teams);
    if (matches) setRRMatches(matches);
  }, [selectedSessionId]);

  const generateNextMatch = useCallback(async () => {
    if (!selectedSessionId || !isSupabaseEnabled || !supabase) return;

    // Read session settings fresh from DB — prevents stale closure on sessions state.
    // This is the Fix 0.2 stale-closure fix: always reads current skill_balance_mode.
    const { data: sess } = await supabase
      .from('open_play_sessions')
      .select('session_type, skill_balance_mode')
      .eq('id', selectedSessionId)
      .single();
    const sessionType = (sess?.session_type ?? 'rotation') as 'rotation' | 'round_robin';
    const balanceMode = (sess?.skill_balance_mode ?? 'arrival_order') as BalanceMode;

    if (sessionType === 'round_robin') {
      // Guard: no new game if one is already active
      const { data: existing } = await supabase
        .from('open_play_games').select('id')
        .eq('session_id', selectedSessionId).in('status', ['rally', 'active']).limit(1);
      if (existing && existing.length > 0) { await loadRRData(); return; }

      const { data: nextRRMatch } = await supabase
        .from('open_play_rr_matches')
        .select('*, team_a:open_play_teams!open_play_rr_matches_team_a_id_fkey(*), team_b:open_play_teams!open_play_rr_matches_team_b_id_fkey(*)')
        .eq('session_id', selectedSessionId)
        .eq('status', 'pending')
        .order('round_number', { ascending: true })
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!nextRRMatch) { await loadRRData(); return; }

      const teamAName = `${nextRRMatch.team_a.player1_name} & ${nextRRMatch.team_a.player2_name}`;
      const teamBName = `${nextRRMatch.team_b.player1_name} & ${nextRRMatch.team_b.player2_name}`;

      let game: OPGame | null = null;
      try {
        const { data, error } = await supabase.from('open_play_games').insert({
          session_id: selectedSessionId,
          team_a: [],
          team_b: [],
          status: 'rally',
          rr_match_id: nextRRMatch.id,
          rr_team_a_id: nextRRMatch.team_a_id,
          rr_team_b_id: nextRRMatch.team_b_id,
          rr_team_a_name: teamAName,
          rr_team_b_name: teamBName,
        }).select().single();
        if (error) {
          if (error.code === '23505') { await loadRRData(); return; }
          throw error;
        }
        game = data;
      } catch (e: any) {
        if (e?.code === '23505') { await loadRRData(); return; }
        throw e;
      }

      await supabase.from('open_play_rr_matches').update({ status: 'active' }).eq('id', nextRRMatch.id);
      await loadRRData();
      setActiveGame(game);
      return;
    }

    // ─── Rotation path ───────────────────────────────────────────────────────

    // Guard: don't create a new game if one is already active
    const { data: existing } = await supabase
      .from('open_play_games').select('id')
      .eq('session_id', selectedSessionId).in('status', ['rally', 'active']).limit(1);
    if (existing && existing.length > 0) { await loadRegistrations(); return; }

    const { data: pool } = await supabase
      .from('open_play_registrations')
      .select('*')
      .eq('session_id', selectedSessionId)
      .eq('status', 'waiting')
      .eq('is_present', true) // Fix 0.3: only select checked-in players
      .order('entered_pool_at', { ascending: true })
      .order('id', { ascending: true }); // Fix D: deterministic secondary sort

    if (!pool || pool.length < PLAYERS_PER_MATCH) { await loadRegistrations(); return; }

    // Fix 0.1: use shared makeMatch (no local copy); Fix D: shared lib uses poolCompare with id tiebreak
    const match = makeMatch(pool, balanceMode);
    if (!match) { await loadRegistrations(); return; }

    const [teamA, teamB] = match;

    let game: OPGame | null = null;
    try {
      // Fix B: the partial unique index one_active_game_per_session rejects concurrent duplicates.
      const { data, error } = await supabase.from('open_play_games').insert({
        session_id: selectedSessionId,
        team_a: teamA.map(p => p.id),
        team_b: teamB.map(p => p.id),
        status: 'rally',
      }).select().single();
      if (error) {
        if (error.code === '23505') { await loadRegistrations(); return; }
        throw error;
      }
      game = data;
    } catch (e: any) {
      if (e?.code === '23505') { await loadRegistrations(); return; }
      throw e;
    }

    const ids = [...teamA, ...teamB].map(p => p.id);
    await supabase.from('open_play_registrations').update({ status: 'playing' }).in('id', ids);

    await loadRegistrations();
    setActiveGame(game);
  }, [selectedSessionId, loadRegistrations, loadActiveGame, loadRRData]);

  useEffect(() => { loadCourts(); }, [loadCourts]);
  useEffect(() => { loadSessions(); }, [courts]);
  useEffect(() => {
    if (selectedSessionId) {
      loadRegistrations();
      loadActiveGame();
      loadRRData();
    }
  }, [selectedSessionId]);

  // Realtime: auto-refresh pool; auto-trigger match when PLAYERS_PER_MATCH-th player joins (Fix A)
  useEffect(() => {
    if (!selectedSessionId || !isSupabaseEnabled || !supabase) return;
    const ch = supabase
      .channel(`admin-op-${selectedSessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_play_registrations', filter: `session_id=eq.${selectedSessionId}` },
        async (payload: any) => {
          await loadRegistrations();
          // Fix A: count field from PostgREST HEAD response (data is null with head:true)
          if (payload.eventType === 'INSERT' || (payload.new?.status === 'waiting' && payload.old?.status !== 'waiting')) {
            const { count } = await supabase!
              .from('open_play_registrations')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', selectedSessionId)
              .eq('status', 'waiting')
              .eq('is_present', true);
            if ((count ?? 0) >= PLAYERS_PER_MATCH) await generateNextMatch();
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_play_games', filter: `session_id=eq.${selectedSessionId}` },
        () => loadActiveGame())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_play_rr_matches', filter: `session_id=eq.${selectedSessionId}` },
        () => loadRRData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedSessionId, loadRegistrations, loadActiveGame, loadRRData, generateNextMatch]);

  const handleStartSession = async () => {
    if (!selectedSessionId || !isSupabaseEnabled || !supabase || !selectedSession) return;

    if (selectedSession.session_type === 'round_robin') {
      // 1. Fetch all checked-in waiting registrations
      const { data: regs } = await supabase
        .from('open_play_registrations')
        .select('id, player_name, skill_tier')
        .eq('session_id', selectedSessionId)
        .eq('status', 'waiting')
        .eq('is_present', true);

      const registrants = (regs ?? []) as { id: string; player_name: string; skill_tier: string }[];
      if (registrants.length < 2) {
        toast('warning', 'Not enough players', 'Need at least 2 checked-in players to start. Mark players present first.');
        return;
      }

      // 2. System-pair into teams
      const { teams: formed, alternate } = pairRegistrationsIntoTeams(
        registrants.map(r => ({ id: r.id, player_name: r.player_name, skill_tier: r.skill_tier as any })),
        selectedSession.skill_balance_mode === 'skill_aware'
      );

      // 3. Insert teams
      const { data: insertedTeams } = await supabase
        .from('open_play_teams')
        .insert(formed.map((t) => ({
          session_id: selectedSessionId,
          player1_name: t.player1.player_name,
          player2_name: t.player2.player_name,
          player1_tier: t.player1.skill_tier,
          player2_tier: t.player2.skill_tier,
          email: null,
          reg1_id: t.player1.id,
          reg2_id: t.player2.id,
        })))
        .select('id, player1_name, player2_name, player1_tier, player2_tier');

      // 4. Mark alternate registration (if odd count) so it's visible in admin
      if (alternate) {
        await supabase.from('open_play_registrations')
          .update({ status: 'alternate' } as any)
          .eq('id', alternate.id);
      }

      await supabase.from('open_play_sessions').update({ status: 'active' }).eq('id', selectedSessionId);
      await loadSessions();

      // 5. Generate schedule from formed teams
      const rrTeamList: RRTeam[] = (insertedTeams ?? []).map((t: any) => ({
        id: t.id,
        name: `${t.player1_name} & ${t.player2_name}`,
      }));

      if (rrTeamList.length < 2) {
        toast('error', 'Team insertion failed', 'Check Supabase logs for details.');
        return;
      }

      const schedule = generateRoundRobinSchedule(rrTeamList);
      const matchInserts = schedule.map(m => ({
        session_id: selectedSessionId,
        team_a_id: m.teamA.id,
        team_b_id: m.isBye ? null : m.teamB?.id,
        round_number: m.round,
        status: m.isBye ? 'bye' : 'pending',
      }));
      await supabase.from('open_play_rr_matches').insert(matchInserts);
      await loadRRData();
      await generateNextMatch();
    } else {
      await supabase.from('open_play_sessions').update({ status: 'active' }).eq('id', selectedSessionId);
      await loadSessions();
      await generateNextMatch();
    }
  };

  const getMaxPoolTime = async (): Promise<number> => {
    const { data } = await supabase!
      .from('open_play_registrations')
      .select('entered_pool_at')
      .eq('session_id', selectedSessionId!)
      .eq('status', 'waiting')
      .order('entered_pool_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? new Date(data.entered_pool_at).getTime() : Date.now();
  };

  const handleGameEnd = async (winner: 'A' | 'B', sA: number, sB: number) => {
    if (!activeGame || !isSupabaseEnabled || !supabase) return;

    if (activeGame.rr_team_a_id && activeGame.rr_team_b_id && activeGame.rr_match_id) {
      // ─── Round-robin game end ────────────────────────────────────────────────
      const winnerTeamId = winner === 'A' ? activeGame.rr_team_a_id : activeGame.rr_team_b_id;
      const loserTeamId  = winner === 'A' ? activeGame.rr_team_b_id : activeGame.rr_team_a_id;
      const wt = rrTeams.find(t => t.id === winnerTeamId);
      const lt = rrTeams.find(t => t.id === loserTeamId);
      const [wFor, wAgainst] = winner === 'A' ? [sA, sB] : [sB, sA];
      const [lFor, lAgainst] = winner === 'A' ? [sB, sA] : [sA, sB];

      await Promise.all([
        supabase.from('open_play_teams').update({
          wins: (wt?.wins ?? 0) + 1,
          losses: wt?.losses ?? 0,
          points_for: (wt?.points_for ?? 0) + wFor,
          points_against: (wt?.points_against ?? 0) + wAgainst,
        }).eq('id', winnerTeamId),
        supabase.from('open_play_teams').update({
          wins: lt?.wins ?? 0,
          losses: (lt?.losses ?? 0) + 1,
          points_for: (lt?.points_for ?? 0) + lFor,
          points_against: (lt?.points_against ?? 0) + lAgainst,
        }).eq('id', loserTeamId),
        supabase.from('open_play_rr_matches').update({
          status: 'ended', score_a: sA, score_b: sB,
        }).eq('id', activeGame.rr_match_id),
      ]);

      setActiveGame(null);
      await loadRRData();

      // Check if all non-bye matches are done → auto-end session
      const { data: pending } = await supabase
        .from('open_play_rr_matches').select('id')
        .eq('session_id', selectedSessionId!).eq('status', 'pending');

      if (!pending || pending.length === 0) {
        await supabase.from('open_play_sessions').update({ status: 'ended' }).eq('id', selectedSessionId!);
        await loadSessions();
        setShowRRChampion(true);
        return;
      }

      await generateNextMatch();
      return;
    }

    // ─── Rotation game end ────────────────────────────────────────────────────
    const winnerIds = winner === 'A' ? activeGame.team_a : activeGame.team_b;
    const loserIds  = winner === 'A' ? activeGame.team_b : activeGame.team_a;

    // Fix 1: relative timestamps — always sort after every currently-waiting player.
    const maxBefore = await getMaxPoolTime();
    const loserTime = new Date(maxBefore + 1000).toISOString();

    for (const id of loserIds) {
      const reg = registrations.find(r => r.id === id);
      await supabase.from('open_play_registrations').update({
        status: 'waiting',
        games_played: (reg?.games_played ?? 0) + 1,
        consecutive_wins: 0,
        entered_pool_at: loserTime,
      }).eq('id', id);
    }

    const maxAfterLosers = await getMaxPoolTime();
    const winnerTime = new Date(maxAfterLosers + 1000).toISOString();

    for (const id of winnerIds) {
      const reg = registrations.find(r => r.id === id);
      const newWins = (reg?.consecutive_wins ?? 0) + 1;
      const bumped  = newWins >= 3;
      await supabase.from('open_play_registrations').update({
        status: 'waiting',
        games_played: (reg?.games_played ?? 0) + 1,
        consecutive_wins: bumped ? 0 : newWins,
        entered_pool_at: winnerTime,
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

  const markPresent = async (regId: string) => {
    if (!supabase) return;
    await supabase.from('open_play_registrations').update({ is_present: true }).eq('id', regId);
    await loadRegistrations();
  };

  const deleteTeam = async (teamId: string) => {
    if (!supabase || !window.confirm('Remove this team?')) return;
    await supabase.from('open_play_teams').delete().eq('id', teamId);
    await loadRRData();
  };

  // Rotation leaderboard
  const leaderboard = [...registrations]
    .filter(r => r.games_played > 0)
    .sort((a, b) => b.consecutive_wins - a.consecutive_wins || b.games_played - a.games_played)
    .slice(0, 5);

  // RR standings
  const rrStandings: OPTeam[] = sortStandings(rrTeams);

  // RR schedule progress
  const totalRRMatches = rrMatches.filter(m => m.status !== 'bye').length;
  const endedRRMatches = rrMatches.filter(m => m.status === 'ended').length;
  const currentRound = rrMatches.find(m => m.status === 'active')?.round_number
    ?? (rrMatches.filter(m => m.status === 'ended').at(-1)?.round_number ?? 0);
  const totalRounds = Math.max(...rrMatches.map(m => m.round_number), 0);

  if (loading) return (
    <div className="text-center py-12 text-sm text-on-surface-variant animate-pulse">Loading Open Play…</div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
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

      {sessions.length === 0 && (
        <div className="text-center py-16 bg-white border border-outline-variant/40 rounded-2xl">
          <div className="text-4xl mb-3">🏓</div>
          <p className="font-bold text-on-surface mb-1">No active sessions</p>
          <p className="text-sm text-on-surface-variant mb-4">Create an Open Play session to get started</p>
          <button onClick={() => setShowCreate(true)} className="bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-xl">Create Session</button>
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
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                  s.session_type === 'round_robin'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-green-100 text-green-700'
                }`}>{s.session_type === 'round_robin' ? 'RR' : 'ROT'}</span>
                {s.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
              </button>
            ))}
          </div>

          {selectedSession && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* LEFT: Pool / Teams panel */}
              <div className="lg:col-span-1 space-y-4">
                {/* Session info */}
                <div className="bg-white border border-outline-variant/40 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-black text-on-surface">{selectedSession.court_name}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {selectedSession.date} · {selectedSession.start_time.slice(0,5)}–{selectedSession.end_time.slice(0,5)}
                      </p>
                      <p className="text-[10px] text-outline mt-0.5 capitalize">
                        {selectedSession.session_type === 'round_robin' ? '🔵 Round-Robin' : '🟢 Rotation'}
                      </p>
                    </div>
                    <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                      selectedSession.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedSession.status}
                    </div>
                  </div>
                  {!isRR && (
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
                  )}
                  {isRR && (
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-outline-variant/60 text-outline">
                        First to {selectedSession.max_score}
                      </span>
                      {selectedSession.player_cap && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-outline-variant/60 text-outline">
                          Team cap: {selectedSession.player_cap}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    {selectedSession.status === 'upcoming' && (
                      <button onClick={handleStartSession}
                        className="flex-1 py-2.5 bg-primary text-white text-xs font-black rounded-xl flex items-center justify-center gap-2">
                        <Play className="w-3.5 h-3.5" /> Start Session
                      </button>
                    )}
                    {selectedSession.status === 'active' && (
                      <button onClick={() => isRR ? handleEndSession() : setShowEndStandings(true)}
                        className="flex-1 py-2.5 bg-red-50 text-red-600 border border-red-200 text-xs font-black rounded-xl">
                        End Session
                      </button>
                    )}
                    <button onClick={() => setShowEdit(true)}
                      className="px-3 py-2.5 border border-outline-variant text-outline text-xs font-bold rounded-xl hover:border-primary hover:text-primary transition-colors">
                      Edit
                    </button>
                  </div>
                </div>

                {/* Rotation: Waiting Pool */}
                {!isRR && (
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
                      <p className="text-xs text-on-surface-variant text-center py-2">No checked-in players waiting</p>
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

                    {waitingPool.length < PLAYERS_PER_MATCH && selectedSession.status === 'active' && (
                      <p className="text-[10px] text-amber-600 font-bold mt-2 text-center">
                        Need {PLAYERS_PER_MATCH - waitingPool.length} more checked-in player{PLAYERS_PER_MATCH - waitingPool.length !== 1 ? 's' : ''} for next match
                      </p>
                    )}

                    {/* Fix 0.3: "Not checked in" sub-list with Mark Present buttons */}
                    {notCheckedIn.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-outline-variant/30">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">
                          Registered — not checked in ({notCheckedIn.length})
                        </p>
                        <div className="space-y-1.5">
                          {notCheckedIn.map(r => (
                            <div key={r.id} className="flex items-center justify-between bg-amber-50 rounded-lg px-2.5 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <TierDot tier={r.skill_tier} />
                                <span className="text-xs font-semibold text-on-surface">{r.player_name}</span>
                              </div>
                              <button
                                onClick={() => markPresent(r.id)}
                                className="flex items-center gap-1 text-[10px] font-black text-green-700 bg-green-100 hover:bg-green-200 px-2 py-0.5 rounded transition-colors">
                                <CheckCircle className="w-3 h-3" /> Mark Present
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Round-Robin: Pre-start — show registered players waiting to be paired */}
                {isRR && selectedSession.status === 'upcoming' && (
                  <div className="bg-white border border-outline-variant/40 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-outline" />
                      <span className="text-xs font-black uppercase tracking-widest text-outline">Registered Players</span>
                      <span className="text-xs font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{registrations.filter(r => r.status === 'waiting').length}</span>
                    </div>
                    {registrations.filter(r => r.status === 'waiting').length === 0 ? (
                      <p className="text-xs text-on-surface-variant text-center py-4">No players registered yet</p>
                    ) : (
                      <div className="space-y-1.5">
                        {registrations.filter(r => r.status === 'waiting').map((r, i) => (
                          <div key={r.id} className="flex items-center justify-between bg-surface-container-low/40 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black text-outline w-4">#{i + 1}</span>
                              <TierDot tier={r.skill_tier} />
                              <span className="text-sm font-semibold text-on-surface">{r.player_name}</span>
                              {!r.is_present && <span className="text-[9px] text-amber-600 font-bold">not checked in</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <TierChip tier={r.skill_tier} />
                              {!r.is_present && (
                                <button onClick={() => markPresent(r.id)}
                                  className="flex items-center gap-1 text-[10px] font-black text-green-700 bg-green-100 hover:bg-green-200 px-2 py-0.5 rounded transition-colors">
                                  <CheckCircle className="w-3 h-3" /> Check In
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-outline mt-3 text-center">
                      Teams are formed automatically when you click Start Session.
                      {registrations.filter(r => r.status === 'waiting' && r.is_present).length >= 2 && (
                        <span className="block text-primary font-black mt-0.5">
                          {registrations.filter(r => r.status === 'waiting' && r.is_present).length} checked-in →{' '}
                          {Math.floor(registrations.filter(r => r.status === 'waiting' && r.is_present).length / 2)} teams
                          {registrations.filter(r => r.status === 'waiting' && r.is_present).length % 2 === 1 ? ' + 1 alternate' : ''}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {/* Round-Robin: Post-start — show formed teams + alternate */}
                {isRR && selectedSession.status !== 'upcoming' && (
                  <div className="bg-white border border-outline-variant/40 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-outline" />
                      <span className="text-xs font-black uppercase tracking-widest text-outline">Teams</span>
                      <span className="text-xs font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{rrTeams.length}</span>
                    </div>
                    {rrTeams.length === 0 ? (
                      <p className="text-xs text-on-surface-variant text-center py-4">No teams formed yet</p>
                    ) : (
                      <div className="space-y-2">
                        {rrTeams.map((t, i) => (
                          <div key={t.id} className="flex items-center justify-between bg-surface-container-low/40 rounded-lg px-3 py-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black text-outline">#{i + 1}</span>
                                <span className="text-sm font-semibold text-on-surface">
                                  {t.player1_name}{t.player1_tier ? ` (${t.player1_tier.charAt(0).toUpperCase() + t.player1_tier.slice(0,3)})` : ''} &amp; {t.player2_name}{t.player2_tier ? ` (${t.player2_tier.charAt(0).toUpperCase() + t.player2_tier.slice(0,3)})` : ''}
                                </span>
                              </div>
                              <span className="text-[10px] text-outline ml-4">{t.wins}W–{t.losses}L</span>
                            </div>
                            <button onClick={() => { setEditTeam(t); setShowAddTeam(true); }}
                              className="text-[10px] font-bold text-outline hover:text-primary px-1.5 py-0.5 rounded border border-outline-variant transition-colors">
                              Edit
                            </button>
                          </div>
                        ))}
                        {/* Alternate — player who didn't get paired due to odd count */}
                        {registrations.filter(r => (r as any).status === 'alternate').map(r => (
                          <div key={r.id} className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black text-amber-600 uppercase">Alternate</span>
                              <span className="text-sm font-semibold text-on-surface">{r.player_name}</span>
                            </div>
                            <span className="text-[9px] text-amber-600">Available if a team needs sub</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-outline mt-2 text-center">
                      {rrTeams.length} teams → {(rrTeams.length * (rrTeams.length - 1)) / 2} matches
                    </p>
                  </div>
                )}

                {/* RR Schedule Progress */}
                {isRR && selectedSession.status === 'active' && rrMatches.length > 0 && (
                  <div className="bg-white border border-outline-variant/40 rounded-2xl p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-outline mb-2">Schedule Progress</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-on-surface">
                        {endedRRMatches} / {totalRRMatches} matches
                      </span>
                      <span className="text-xs text-outline">Round {currentRound}/{totalRounds}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${totalRRMatches > 0 ? (endedRRMatches / totalRRMatches) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}

                {/* RR Standings */}
                {isRR && rrStandings.some(t => t.wins + t.losses > 0) && (
                  <div className="bg-white border border-outline-variant/40 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-black uppercase tracking-widest text-outline">Standings</span>
                    </div>
                    <div className="space-y-2">
                      {rrStandings.map((t, i) => {
                        const diff = t.points_for - t.points_against;
                        return (
                          <div key={t.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-outline w-4">{i + 1}</span>
                              <span className="text-xs font-semibold text-on-surface">{t.player1_name} & {t.player2_name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-primary">{t.wins}W–{t.losses}L</span>
                              <span className={`text-[10px] ml-1 ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                ({diff >= 0 ? '+' : ''}{diff})
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Rotation Leaderboard */}
                {!isRR && leaderboard.length > 0 && (
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
                      {isRR && activeGame.rr_team_a_name && (
                        <span className="text-xs text-outline">
                          {activeGame.rr_team_a_name} vs {activeGame.rr_team_b_name}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/open-play/live?session=${selectedSession.id}`;
                          navigator.clipboard.writeText(url).then(() => {
                            const btn = document.getElementById('share-live-btn');
                            if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = '⬡ Share Live Link'; }, 2000); }
                          });
                        }}
                        id="share-live-btn"
                        className="ml-auto text-[11px] font-semibold border border-outline-variant/50 rounded-lg px-3 py-1 hover:bg-surface-variant/40 transition-colors"
                      >⬡ Share Live Link</button>
                    </div>
                    <ScoringPanel
                      game={activeGame}
                      registrations={registrations}
                      maxScore={selectedSession.max_score}
                      onGameEnd={handleGameEnd}
                      onUpdate={() => loadActiveGame()}
                      rrMode={isRR && activeGame.rr_team_a_name && activeGame.rr_team_b_name
                        ? { teamA: activeGame.rr_team_a_name, teamB: activeGame.rr_team_b_name }
                        : undefined}
                    />
                  </>
                ) : (
                  <div className="bg-white border border-outline-variant/40 rounded-2xl p-8 text-center">
                    {selectedSession.status === 'upcoming' ? (
                      <>
                        <div className="text-3xl mb-3">🏓</div>
                        <p className="font-bold text-on-surface mb-1">Session not started</p>
                        <p className="text-sm text-on-surface-variant mb-4">
                          {isRR ? 'Add all teams then tap Start Session to generate the schedule' : 'Add players then tap Start Session'}
                        </p>
                      </>
                    ) : isRR ? (
                      rrMatches.filter(m => m.status === 'pending').length === 0 && rrMatches.length > 0 ? (
                        <>
                          <div className="text-3xl mb-3">🏆</div>
                          <p className="font-bold text-on-surface mb-1">All matches complete!</p>
                          <button onClick={() => setShowRRChampion(true)}
                            className="bg-amber-500 text-white text-sm font-black px-6 py-3 rounded-xl mt-4">
                            View Final Standings
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="text-3xl mb-3">⚡</div>
                          <p className="font-bold text-on-surface mb-1">Ready for next match</p>
                          <button onClick={generateNextMatch}
                            className="bg-primary text-white text-sm font-black px-6 py-3 rounded-xl mt-4">
                            Start Next Match
                          </button>
                        </>
                      )
                    ) : waitingPool.length >= PLAYERS_PER_MATCH ? (
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
                        <p className="font-bold text-on-surface mb-1">
                          Waiting for players ({waitingPool.length}/{PLAYERS_PER_MATCH} checked in)
                        </p>
                        <p className="text-sm text-on-surface-variant">
                          Need {PLAYERS_PER_MATCH - waitingPool.length} more — match generates automatically when ready
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Playing now (rotation only) */}
                {!isRR && playingNow.length > 0 && (
                  <div className="bg-white border border-outline-variant/40 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-primary" />
                      <span className="text-xs font-black uppercase tracking-widest text-outline">On Court Now</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {playingNow.map(r => (
                        <div key={r.id} className="flex items-center gap-1.5 bg-white border border-outline-variant/40 rounded-lg px-2 py-1.5 text-xs">
                          <TierDot tier={r.skill_tier} />
                          <span className="font-semibold text-on-surface">{r.player_name}</span>
                          {r.is_walkin && <span className="text-[9px] text-outline">(walk-in)</span>}
                        </div>
                      ))}
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
      {showAddTeam && selectedSessionId && (
        <AddTeamModal
          sessionId={selectedSessionId}
          existingTeam={editTeam}
          onClose={() => { setShowAddTeam(false); setEditTeam(undefined); }}
          onSaved={loadRRData}
        />
      )}
      {showEdit && selectedSession && (
        <EditSessionModal session={selectedSession} onClose={() => setShowEdit(false)} onSaved={loadSessions} />
      )}
      {showEndStandings && !isRR && (
        <RotationEndStandingsModal
          registrations={registrations}
          onConfirmEnd={async () => { setShowEndStandings(false); await handleEndSession(); }}
        />
      )}
      {showRRChampion && (
        <RRChampionModal teams={rrTeams} onClose={() => setShowRRChampion(false)} />
      )}
    </div>
  );
}
