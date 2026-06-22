import { useState, useEffect, useCallback, type ReactNode, type FormEvent } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Plus, Shuffle, Lock, Trophy, Share2, RefreshCw, X } from 'lucide-react';
import BracketView from '../../components/BracketView';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import { useToast, ToastContainer } from '../../components/Toast';
import {
  generateSeeds, swapSlots, reshuffleSeeds, buildRound1Matches,
  getTeamName, isRoundComplete,
} from '../../lib/tournamentBracket';
import type { TPlayer, TMatch, BracketSlot } from '../../lib/tournamentBracket';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Tournament {
  id: string;
  name: string;
  date: string;
  status: 'registration' | 'seeding' | 'active' | 'completed';
  max_players: number;
  skill_filter: string;
}

interface OPGame {
  id: string;
  score_a: number;
  score_b: number;
  serving_team: 'A' | 'B' | null;
  server_index: number;
  first_serve_done: boolean;
  status: 'rally' | 'active' | 'ended';
  winner_team: 'A' | 'B' | null;
  team_a: string[];
  team_b: string[];
}

// â”€â”€â”€ Draggable Player Chip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DraggablePlayer({ slot, isDragging }: { slot: BracketSlot; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `slot-${slot.seed}` });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`px-3 py-2 rounded-lg border-2 cursor-grab active:cursor-grabbing text-sm font-bold select-none transition-all
        ${slot.playerId
          ? 'bg-white border-primary/40 text-on-surface hover:border-primary hover:shadow-sm'
          : 'bg-gray-50 border-dashed border-gray-300 text-gray-400 cursor-default'
        }
        ${isDragging ? 'opacity-30' : ''}
      `}
    >
      {slot.playerName}
    </div>
  );
}

function DroppableSlot({ slot, children, isOver }: { slot: BracketSlot; children: ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: `slot-${slot.seed}` });
  return (
    <div ref={setNodeRef} className={`rounded-lg transition-all ${isOver ? 'ring-2 ring-primary ring-offset-1' : ''}`}>
      {children}
    </div>
  );
}


// â”€â”€â”€ Create Tournament Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CreateTournamentModal({ onClose, onCreate }: { onClose: () => void; onCreate: (t: Tournament) => void }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [maxPlayers, setMaxPlayers] = useState(12);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    const { data, error } = await supabase.from('tournaments').insert({
      name, date, max_players: maxPlayers, status: 'registration', skill_filter: 'all',
    }).select().single();
    if (!error && data) onCreate(data as Tournament);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black text-on-surface">New Tournament</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-outline" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-outline uppercase tracking-wide block mb-1">Tournament Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              placeholder="e.g. Summer Open 2026"
              className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-bold text-outline uppercase tracking-wide block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-bold text-outline uppercase tracking-wide block mb-1">Max Players</label>
            <div className="flex gap-3">
              {[10, 12].map(n => (
                <button key={n} type="button" onClick={() => setMaxPlayers(n)}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-bold transition-all
                    ${maxPlayers === n ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant text-outline'}`}>
                  {n} players
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving || !name}
            className="w-full py-3 bg-primary text-white font-black rounded-xl disabled:opacity-50 transition-colors hover:bg-primary/90">
            {saving ? 'Creating...' : 'Create Tournament'}
          </button>
        </form>
      </div>
    </div>
  );
}

// â”€â”€â”€ Add Player Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AddPlayerModal({
  tournamentId, onClose, onAdd,
}: { tournamentId: string; onClose: () => void; onAdd: (p: TPlayer) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<'beginner' | 'intermediate' | 'pro'>('beginner');
  const [saving, setSaving] = useState(false);

  const tiers = [
    { value: 'beginner', label: 'Beg' },
    { value: 'intermediate', label: 'Mid' },
    { value: 'pro', label: 'Pro' },
  ] as const;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    const { data, error } = await supabase.from('tournament_players').insert({
      tournament_id: tournamentId,
      player_name: name,
      player_email: email || null,
      skill_tier: tier,
      losses: 0,
      status: 'active',
    }).select().single();
    if (!error && data) onAdd(data as TPlayer);
    setSaving(false);
    setName(''); setEmail('');
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black">Add Player</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-outline" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} required
            placeholder="Player name"
            className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <div className="flex gap-2">
            {tiers.map(t => (
              <button key={t.value} type="button" onClick={() => setTier(t.value)}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all
                  ${tier === t.value ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant text-outline'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <button type="submit" disabled={saving || !name}
            className="w-full py-2.5 bg-primary text-white font-black text-sm rounded-xl disabled:opacity-50">
            {saving ? 'Adding...' : 'Add Player'}
          </button>
        </form>
      </div>
    </div>
  );
}

// â”€â”€â”€ Scoring Modal (wraps existing scoring logic inline) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ScoringModal({
  match, players, tournament, onClose, onComplete,
}: {
  match: TMatch;
  players: TPlayer[];
  tournament: Tournament;
  onClose: () => void;
  onComplete: (matchId: string, winnerTeam: 'A' | 'B', scoreA: number, scoreB: number) => void;
}) {
  const teamAName = getTeamName(match, 'A', players);
  const teamBName = getTeamName(match, 'B', players);

  const [sA, setSA] = useState(match.score_a);
  const [sB, setSB] = useState(match.score_b);
  const [servingTeam, setServingTeam] = useState<'A' | 'B'>(match.score_a === 0 && match.score_b === 0 ? 'A' : (match.score_a > match.score_b ? 'A' : 'B'));
  const [serverIdx, setServerIdx] = useState(0);
  const [screen, setScreen] = useState<'rally' | 'scoring' | 'over'>(
    match.status === 'active' ? 'scoring' : match.status === 'completed' ? 'over' : 'rally'
  );
  const [saving, setSaving] = useState(false);

  const maxScore = 15;
  const isDeuce = (a: number, b: number) => a >= 10 && b >= 10;
  const isGameOver = (a: number, b: number) => {
    if (a >= maxScore || b >= maxScore) return true;
    if (isDeuce(a, b)) return Math.abs(a - b) >= 2;
    return (a >= 11 || b >= 11) && Math.abs(a - b) >= 2;
  };

  const serverName = servingTeam === 'A'
    ? (serverIdx === 0 ? players.find(p => p.id === match.team_a_p1)?.player_name : players.find(p => p.id === match.team_a_p2)?.player_name) ?? `Team A P${serverIdx + 1}`
    : (serverIdx === 0 ? players.find(p => p.id === match.team_b_p1)?.player_name : players.find(p => p.id === match.team_b_p2)?.player_name) ?? `Team B P${serverIdx + 1}`;

  const persist = async (scoreA: number, scoreB: number, sTeam: 'A' | 'B', sIdx: number) => {
    await supabase?.from('tournament_matches').update({ score_a: scoreA, score_b: scoreB, status: 'active' }).eq('id', match.id);
  };

  const doPoint = async () => {
    const newA = servingTeam === 'A' ? sA + 1 : sA;
    const newB = servingTeam === 'B' ? sB + 1 : sB;
    setSA(newA); setSB(newB);
    await persist(newA, newB, servingTeam, serverIdx);
    if (isGameOver(newA, newB)) setScreen('over');
  };

  const doSideOut = async () => {
    let newTeam = servingTeam;
    let newIdx = serverIdx;
    if (servingTeam === 'A') {
      if (serverIdx === 0 && !isDeuce(sA, sB)) { newIdx = 1; }
      else { newTeam = 'B'; newIdx = 0; }
    } else {
      if (serverIdx === 0 && !isDeuce(sA, sB)) { newIdx = 1; }
      else { newTeam = 'A'; newIdx = 0; }
    }
    setServingTeam(newTeam); setServerIdx(newIdx);
    await persist(sA, sB, newTeam, newIdx);
  };

  const handleConfirmWinner = async () => {
    const winner = sA > sB ? 'A' : 'B';
    setSaving(true);
    await supabase?.from('tournament_matches').update({
      score_a: sA, score_b: sB, winner_team: winner, status: 'completed',
    }).eq('id', match.id);

    // Update loser's loss count
    const loserP1 = winner === 'A' ? match.team_b_p1 : match.team_a_p1;
    const loserP2 = winner === 'A' ? match.team_b_p2 : match.team_a_p2;
    const loserIds = [loserP1, loserP2].filter(Boolean);
    for (const pid of loserIds) {
      const loser = players.find(p => p.id === pid);
      if (loser) {
        const newLosses = (loser.losses ?? 0) + 1;
        await supabase?.from('tournament_players').update({
          losses: newLosses,
          status: newLosses >= 2 ? 'eliminated' : 'active',
        }).eq('id', pid);
      }
    }

    onComplete(match.id, winner, sA, sB);
    setSaving(false);
  };

  const getSide = (team: 'A' | 'B') => (team === 'A' ? sA : sB) % 2 === 0 ? 'Right' : 'Left';

  const teamAPlayers = [players.find(p => p.id === match.team_a_p1), players.find(p => p.id === match.team_a_p2)].filter(Boolean) as TPlayer[];
  const teamBPlayers = [players.find(p => p.id === match.team_b_p1), players.find(p => p.id === match.team_b_p2)].filter(Boolean) as TPlayer[];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-outline">
              {match.bracket === 'winners' ? 'ðŸ† Winners' : match.bracket === 'losers' ? 'ðŸ”µ Losers' : 'ðŸŽ¯ Grand Final'} Â· Round {match.round}
            </span>
            <p className="text-sm font-bold text-on-surface mt-0.5">{teamAName} vs {teamBName}</p>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {screen === 'rally' && (
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-outline mb-3">Rally for Serve â€” who won?</p>
              <div className="grid grid-cols-2 gap-3">
                {(['A', 'B'] as const).map(team => (
                  <button key={team} onClick={() => { setServingTeam(team); setScreen('scoring'); supabase?.from('tournament_matches').update({ status: 'active' }).eq('id', match.id); }}
                    className="p-4 border-2 border-outline-variant hover:border-primary hover:bg-green-50 rounded-xl text-left transition-all">
                    <div className="text-xs font-black text-primary mb-1">Team {team} wins rally</div>
                    <div className="text-sm font-bold">{team === 'A' ? teamAName : teamBName}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {screen === 'scoring' && (
            <>
              {/* Scoreboard */}
              <div className="bg-white border border-outline-variant/40 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_60px_1fr] divide-x divide-outline-variant/20">
                  {/* Team A */}
                  <div className={`p-3 rounded-xl ${servingTeam === 'A' ? 'bg-green-50' : 'bg-white'}`}>
                    <div className="text-[9px] font-black uppercase tracking-widest text-outline mb-2">Team A</div>
                    {teamAPlayers.map((p, i) => {
                      const isServer = servingTeam === 'A' && serverIdx === i;
                      return (
                        <div key={p.id} className={`flex items-center justify-between rounded-lg px-2 py-1.5 mb-1 ${isServer ? 'bg-primary/10' : ''}`}>
                          <span className={`text-xs font-bold ${isServer ? 'text-primary' : 'text-on-surface'}`}>{p.player_name}</span>
                          {isServer && <span className="text-[9px] font-black bg-primary text-white px-1.5 py-0.5 rounded-full">SERVING Â· {getSide('A')}</span>}
                        </div>
                      );
                    })}
                  </div>
                  {/* Score */}
                  <div className="flex flex-col items-center justify-center py-4 bg-gray-50">
                    <div className={`text-3xl font-black leading-none ${sA > sB ? 'text-primary' : 'text-on-surface'}`}>{sA}</div>
                    <div className="text-gray-300 text-lg">â€“</div>
                    <div className={`text-3xl font-black leading-none ${sB > sA ? 'text-primary' : 'text-on-surface'}`}>{sB}</div>
                  </div>
                  {/* Team B */}
                  <div className={`p-3 rounded-xl ${servingTeam === 'B' ? 'bg-green-50' : 'bg-white'}`}>
                    <div className="text-[9px] font-black uppercase tracking-widest text-outline mb-2">Team B</div>
                    {teamBPlayers.map((p, i) => {
                      const isServer = servingTeam === 'B' && serverIdx === i;
                      return (
                        <div key={p.id} className={`flex items-center justify-between rounded-lg px-2 py-1.5 mb-1 ${isServer ? 'bg-primary/10' : ''}`}>
                          <span className={`text-xs font-bold ${isServer ? 'text-primary' : 'text-on-surface'}`}>{p.player_name}</span>
                          {isServer && <span className="text-[9px] font-black bg-primary text-white px-1.5 py-0.5 rounded-full">SERVING Â· {getSide('B')}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* Serve indicator */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-semibold text-amber-800 text-center">
                ðŸ“ {serverName} is serving Â· {getSide(servingTeam)} side
                {isDeuce(sA, sB) && <span className="ml-2 font-black text-red-600">Â· DEUCE</span>}
              </div>
              {/* Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={doPoint}
                  className="py-4 bg-primary text-white font-black text-base rounded-xl hover:bg-primary/90 transition-colors">
                  âœ… Point
                  <div className="text-xs font-normal opacity-80">Serving team scores</div>
                </button>
                <button onClick={doSideOut}
                  className="py-4 bg-gray-100 text-on-surface font-black text-base rounded-xl hover:bg-gray-200 transition-colors">
                  ðŸ”„ Side Out
                  <div className="text-xs font-normal text-outline">Serve changes</div>
                </button>
              </div>
            </>
          )}

          {screen === 'over' && (
            <div className="text-center space-y-3">
              <div className="text-3xl">ðŸ…</div>
              <p className="text-lg font-black text-primary">Game Over!</p>
              <p className="text-3xl font-black">{sA} â€“ {sB}</p>
              <p className="text-sm font-bold">{sA > sB ? teamAName : teamBName} win!</p>
              <button onClick={handleConfirmWinner} disabled={saving}
                className="w-full py-3 bg-primary text-white font-black text-sm rounded-xl disabled:opacity-50">
                {saving ? 'Saving...' : 'âœ“ Confirm & Advance Bracket'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function TournamentView() {
  const { toasts, toast, removeToast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [players, setPlayers] = useState<TPlayer[]>([]);
  const [matches, setMatches] = useState<TMatch[]>([]);
  const [slots, setSlots] = useState<BracketSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [activeMatchForScoring, setActiveMatchForScoring] = useState<TMatch | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [overSlotId, setOverSlotId] = useState<string | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirst, setSwapFirst] = useState<TMatch | null>(null);

  const tournament = tournaments.find(t => t.id === selectedId);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // â”€â”€ Load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const loadTournaments = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
    if (data) setTournaments(data as Tournament[]);
    setLoading(false);
  }, []);

  const loadTournamentData = useCallback(async (tid: string) => {
    if (!supabase) return;
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('tournament_players').select('*').eq('tournament_id', tid).order('registered_at'),
      supabase.from('tournament_matches').select('*').eq('tournament_id', tid).order('round').order('match_number'),
    ]);
    if (p) setPlayers(p as TPlayer[]);
    if (m) setMatches(m as TMatch[]);
  }, []);

  useEffect(() => { loadTournaments(); }, [loadTournaments]);
  useEffect(() => {
    if (selectedId) loadTournamentData(selectedId);
  }, [selectedId, loadTournamentData]);

  // Realtime match updates
  useEffect(() => {
    if (!selectedId || !supabase) return;
    const channel = supabase.channel(`tournament-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${selectedId}` },
        () => loadTournamentData(selectedId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_players', filter: `tournament_id=eq.${selectedId}` },
        () => loadTournamentData(selectedId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, loadTournamentData]);

  // Init seeds when tournament moves to seeding
  useEffect(() => {
    if (tournament?.status === 'seeding' && players.length > 0 && slots.length === 0) {
      setSlots(generateSeeds(players));
    }
  }, [tournament?.status, players, slots.length]);

  // â”€â”€ Drag & Drop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleDragStart = (e: DragStartEvent) => setDragActiveId(e.active.id as string);
  const handleDragOver = (e: any) => setOverSlotId(e.over?.id ?? null);

  const handleDragEnd = (e: DragEndEvent) => {
    setDragActiveId(null);
    setOverSlotId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromSeed = parseInt((active.id as string).replace('slot-', '')) - 1;
    const toSeed = parseInt((over.id as string).replace('slot-', '')) - 1;
    setSlots(prev => swapSlots(prev, fromSeed, toSeed));
  };

  // â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleStartSeeding = async () => {
    if (!supabase || !selectedId) return;
    if (players.length < 4) { toast('warning', 'Need at least 4 players', 'Minimum 2 teams required.'); return; }
    await supabase.from('tournaments').update({ status: 'seeding' }).eq('id', selectedId);
    setSlots(generateSeeds(players));
    setTournaments(prev => prev.map(t => t.id === selectedId ? { ...t, status: 'seeding' } : t));
  };

  const handleLockBracket = async () => {
    if (!supabase || !selectedId) return;
    const r1 = buildRound1Matches(slots, selectedId);
    const { error } = await supabase.from('tournament_matches').insert(r1);
    if (error) { toast('error', 'Failed to lock bracket', error.message); return; }
    // Save seeds to players
    for (const slot of slots) {
      if (slot.playerId) {
        await supabase.from('tournament_players').update({ seed: slot.seed }).eq('id', slot.playerId);
      }
    }
    await supabase.from('tournaments').update({ status: 'active' }).eq('id', selectedId);
    setTournaments(prev => prev.map(t => t.id === selectedId ? { ...t, status: 'active' } : t));
    await loadTournamentData(selectedId);
    toast('success', 'Bracket locked!', 'Round 1 matches are ready.');
  };

  const handleMatchComplete = async (matchId: string, winnerTeam: 'A' | 'B', scoreA: number, scoreB: number) => {
    setActiveMatchForScoring(null);
    await loadTournamentData(selectedId!);

    // Check if all current round matches are done â†’ generate next round
    const updated = await supabase?.from('tournament_matches').select('*').eq('tournament_id', selectedId!).order('round').order('match_number');
    if (!updated?.data) return;
    const allMatches = updated.data as TMatch[];
    setMatches(allMatches);

    const maxWBRound = Math.max(...allMatches.filter(m => m.bracket === 'winners').map(m => m.round), 0);
    const maxLBRound = Math.max(...allMatches.filter(m => m.bracket === 'losers').map(m => m.round), 0);
    const currentWB = allMatches.filter(m => m.bracket === 'winners' && m.round === maxWBRound);
    const currentLB = allMatches.filter(m => m.bracket === 'losers' && m.round === maxLBRound);

    if (!isRoundComplete([...currentWB, ...currentLB])) return;

    // Check for grand final
    const grandFinal = allMatches.find(m => m.bracket === 'grand_final');
    if (grandFinal) {
      if (grandFinal.status === 'completed') {
        await supabase?.from('tournaments').update({ status: 'completed' }).eq('id', selectedId!);
        setTournaments(prev => prev.map(t => t.id === selectedId ? { ...t, status: 'completed' } : t));
        toast('success', 'ðŸ† Tournament Complete!', 'Grand Final finished.');
      }
      return;
    }

    const { advanceRound } = await import('../../lib/tournamentBracket');
    const isWBFinal = currentWB.length === 1;
    const result = advanceRound(selectedId!, currentWB, currentLB, maxWBRound + 1, maxLBRound + 1, isWBFinal);

    const toInsert = [...result.nextWBMatches, ...result.nextLBMatches, ...(result.grandFinal ? [result.grandFinal] : [])];
    if (toInsert.length > 0) {
      await supabase?.from('tournament_matches').insert(toInsert);
      await loadTournamentData(selectedId!);
      toast('info', 'Next round ready', `Round ${maxWBRound + 1} matches generated.`);
    }
  };

  const handleSwapClick = async (clicked: TMatch) => {
    if (clicked.status !== 'pending') return;
    if (!swapFirst) { setSwapFirst(clicked); return; }
    if (swapFirst.id === clicked.id) { setSwapFirst(null); return; }
    if (swapFirst.bracket !== clicked.bracket) {
      toast('warning', 'Same bracket only', 'Can only swap within the same bracket.');
      return;
    }
    const a = swapFirst, b = clicked;
    await Promise.all([
      supabase?.from('tournament_matches').update({
        team_a_p1: b.team_a_p1, team_a_p2: b.team_a_p2,
        team_b_p1: b.team_b_p1, team_b_p2: b.team_b_p2,
      }).eq('id', a.id),
      supabase?.from('tournament_matches').update({
        team_a_p1: a.team_a_p1, team_a_p2: a.team_a_p2,
        team_b_p1: a.team_b_p1, team_b_p2: a.team_b_p2,
      }).eq('id', b.id),
    ]);
    setSwapFirst(null);
    await loadTournamentData(selectedId!);
    toast('success', 'Swapped!', 'Match pairings updated.');
  };

  // â”€â”€ Render helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const draggedSlot = dragActiveId ? slots.find(s => `slot-${s.seed}` === dragActiveId) : null;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">Tournament</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Double elimination bracket</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Tournament
        </button>
      </div>

      {/* Tournament tabs */}
      {tournaments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tournaments.map(t => (
            <button key={t.id} onClick={() => setSelectedId(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border whitespace-nowrap text-sm font-bold transition-all
                ${selectedId === t.id ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface border-outline-variant/40 hover:border-primary/40'}`}>
              <Trophy className="w-3.5 h-3.5" />
              {t.name}
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${selectedId === t.id ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                {t.status.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}

      {!selectedId && (
        <div className="bg-white border border-outline-variant/40 rounded-2xl p-12 text-center">
          <Trophy className="w-12 h-12 text-outline mx-auto mb-3" />
          <p className="font-bold text-on-surface">No tournaments yet</p>
          <p className="text-sm text-on-surface-variant mt-1">Create one to get started</p>
        </div>
      )}

      {tournament && (
        <div className="space-y-6">
          {/* Share link */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-black px-3 py-1 rounded-full ${
              tournament.status === 'active' ? 'bg-green-100 text-green-700' :
              tournament.status === 'completed' ? 'bg-gray-100 text-gray-600' :
              'bg-amber-100 text-amber-700'
            }`}>{tournament.status.toUpperCase()}</span>
            <span className="text-sm text-on-surface-variant">{tournament.date}</span>
            <button
              onClick={() => {
                const url = `${window.location.origin}/tournament/${tournament.id}`;
                navigator.clipboard.writeText(url).then(() => toast('success', 'Link copied!', url));
              }}
              className="ml-auto flex items-center gap-1.5 text-xs font-semibold border border-outline-variant/50 rounded-lg px-3 py-1.5 hover:bg-surface-variant/40 transition-colors">
              <Share2 className="w-3.5 h-3.5" /> Share Live Bracket
            </button>
          </div>

          {/* â”€â”€ REGISTRATION â”€â”€ */}
          {tournament.status === 'registration' && (
            <div className="grid lg:grid-cols-[300px_1fr] gap-6">
              <div className="bg-white border border-outline-variant/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-outline">Players ({players.length}/{tournament.max_players})</span>
                  <button onClick={() => setShowAddPlayer(true)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                {players.length === 0 ? (
                  <p className="text-xs text-on-surface-variant text-center py-4">No players yet</p>
                ) : (
                  <div className="space-y-2">
                    {players.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                        <span className="text-xs font-black text-outline w-5">{i + 1}</span>
                        <span className="text-sm font-bold text-on-surface flex-1">{p.player_name}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                          p.skill_tier === 'pro' ? 'bg-amber-100 text-amber-700' :
                          p.skill_tier === 'intermediate' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>{p.skill_tier.slice(0,3).toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white border border-outline-variant/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4">
                <div className="text-4xl">ðŸŽ¯</div>
                <div>
                  <p className="font-black text-on-surface text-lg">Ready to seed the bracket?</p>
                  <p className="text-sm text-on-surface-variant mt-1">{players.length} players registered Â· need {players.length % 4 === 0 ? 'even' : 'more'} for clean bracket</p>
                </div>
                <button onClick={handleStartSeeding} disabled={players.length < 4}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-black rounded-xl disabled:opacity-50 hover:bg-primary/90 transition-colors">
                  <Shuffle className="w-4 h-4" /> Start Seeding
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ SEEDING â”€â”€ */}
          {tournament.status === 'seeding' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-on-surface-variant flex-1">Drag players to swap positions. Adjacent pairs form teams. Pair of teams = one match.</p>
                <button onClick={() => setSlots(prev => reshuffleSeeds(prev))}
                  className="flex items-center gap-1.5 text-sm font-bold border border-outline-variant rounded-xl px-4 py-2 hover:bg-gray-50">
                  <Shuffle className="w-4 h-4" /> Randomize All
                </button>
                <button onClick={handleLockBracket}
                  className="flex items-center gap-1.5 text-sm font-bold bg-primary text-white rounded-xl px-4 py-2 hover:bg-primary/90">
                  <Lock className="w-4 h-4" /> Lock & Start
                </button>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter}
                onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>

                {/* Slot grid â€” groups of 4 = 1 match */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: Math.ceil(slots.length / 4) }, (_, matchIdx) => {
                    const matchSlots = slots.slice(matchIdx * 4, matchIdx * 4 + 4);
                    return (
                      <div key={matchIdx} className="bg-white border border-outline-variant/40 rounded-2xl p-4 space-y-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-outline">Match {matchIdx + 1}</span>
                        {/* Team A (slots 0-1) */}
                        <div className="space-y-1.5">
                          <span className="text-[9px] text-outline font-bold">Team A</span>
                          {matchSlots.slice(0, 2).map(slot => (
                            <DroppableSlot key={slot.seed} slot={slot} isOver={overSlotId === `slot-${slot.seed}`}>
                              <DraggablePlayer slot={slot} isDragging={dragActiveId === `slot-${slot.seed}`} />
                            </DroppableSlot>
                          ))}
                        </div>
                        <div className="text-[9px] text-center text-outline font-black">VS</div>
                        {/* Team B (slots 2-3) */}
                        <div className="space-y-1.5">
                          <span className="text-[9px] text-outline font-bold">Team B</span>
                          {matchSlots.slice(2, 4).map(slot => (
                            slot ? (
                              <DroppableSlot key={slot.seed} slot={slot} isOver={overSlotId === `slot-${slot.seed}`}>
                                <DraggablePlayer slot={slot} isDragging={dragActiveId === `slot-${slot.seed}`} />
                              </DroppableSlot>
                            ) : (
                              <div key="bye" className="px-3 py-2 rounded-lg border-dashed border-2 border-gray-200 text-xs text-gray-400 italic">BYE</div>
                            )
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <DragOverlay>
                  {draggedSlot && (
                    <div className="px-3 py-2 rounded-lg border-2 border-primary bg-white shadow-xl text-sm font-bold text-primary cursor-grabbing">
                      {draggedSlot.playerName}
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            </div>
          )}

          {/* â”€â”€ ACTIVE / BRACKET VIEW â”€â”€ */}
          {(tournament.status === 'active' || tournament.status === 'completed') && (
            <div className="space-y-6">
              {/* Players standings */}
              <div className="bg-white border border-outline-variant/40 rounded-2xl p-4">
                <div className="flex flex-wrap gap-3">
                  {players.map(p => (
                    <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold
                      ${p.status === 'eliminated' ? 'bg-gray-100 text-gray-400 border-gray-200 line-through' :
                        p.losses === 1 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-green-50 text-primary border-primary/20'}`}>
                      {p.player_name}
                      <span className="text-[9px]">{p.losses === 0 ? '0L' : p.losses === 1 ? '1L âš ï¸' : 'âŒ'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bracket â€” MSC / TI style */}
              <BracketView
                matches={matches}
                players={players}
                activeMatchId={activeMatchForScoring?.id ?? null}
                onMatchClick={m => {
                  if (m.status !== 'bye') setActiveMatchForScoring(m);
                }}
              />

              {tournament.status === 'completed' && (() => {
                const gf = matches.find(m => m.bracket === 'grand_final');
                return gf?.winner_team ? (
                  <div className="bg-gradient-to-b from-amber-50 to-white border-2 border-amber-400 rounded-2xl p-8 text-center">
                    <div className="text-4xl mb-2">ðŸ†</div>
                    <p className="text-2xl font-black text-amber-600">Tournament Champion!</p>
                    <p className="text-lg font-bold text-on-surface mt-2">
                      {getTeamName(gf, gf.winner_team, players)}
                    </p>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateTournamentModal
          onClose={() => setShowCreate(false)}
          onCreate={t => { setTournaments(prev => [t, ...prev]); setSelectedId(t.id); setShowCreate(false); }}
        />
      )}
      {showAddPlayer && selectedId && (
        <AddPlayerModal
          tournamentId={selectedId}
          onClose={() => setShowAddPlayer(false)}
          onAdd={p => { setPlayers(prev => [...prev, p]); setShowAddPlayer(false); }}
        />
      )}
      {activeMatchForScoring && tournament && (
        <ScoringModal
          match={activeMatchForScoring}
          players={players}
          tournament={tournament}
          onClose={() => setActiveMatchForScoring(null)}
          onComplete={handleMatchComplete}
        />
      )}
    </div>
  );
}

