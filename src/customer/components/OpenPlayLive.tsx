import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OPSession {
  id: string;
  court_id: number;
  court_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  skill_filter: string;
  max_score: number;
  status: string;
}

interface OPRegistration {
  id: string;
  player_name: string;
  skill_tier: 'beginner' | 'intermediate' | 'pro';
  status: 'waiting' | 'playing' | 'done';
  entered_pool_at: string;
  games_played: number;
  consecutive_wins: number;
}

interface OPGame {
  id: string;
  team_a: string[];
  team_b: string[];
  score_a: number;
  score_b: number;
  serving_team: 'A' | 'B' | null;
  server_index: number;
  status: 'rally' | 'active' | 'ended';
  winner_team: 'A' | 'B' | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_DOT: Record<string, string> = {
  pro: 'bg-amber-400',
  intermediate: 'bg-blue-400',
  beginner: 'bg-green-400',
};

const TIER_LABEL: Record<string, string> = {
  pro: 'Pro',
  intermediate: 'Mid',
  beginner: 'Beg',
};

function TierDot({ tier, size = 'sm' }: { tier: string; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'w-3 h-3' : 'w-2 h-2';
  return <span className={`inline-block ${sz} rounded-full ${TIER_DOT[tier] ?? 'bg-gray-400'} shrink-0`} />;
}

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-sm text-[#4b5563]">
      {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface WinnerAnnouncement {
  winnerTeam: 'A' | 'B';
  winnerNames: string[];
  scoreA: number;
  scoreB: number;
}

export default function OpenPlayLive() {
  const [sessions, setSessions] = useState<OPSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<OPRegistration[]>([]);
  const [activeGame, setActiveGame] = useState<OPGame | null>(null);
  const [nextGame, setNextGame] = useState<OPGame | null>(null);
  const [loading, setLoading] = useState(true);
  // Fix F: transient winner announcement state, auto-clears after 8 seconds
  const [announcement, setAnnouncement] = useState<WinnerAnnouncement | null>(null);

  const session = sessions.find(s => s.id === selectedId);
  const waitingPool = registrations.filter(r => r.status === 'waiting');
  const leaderboard = [...registrations]
    .filter(r => r.games_played > 0)
    .sort((a, b) => b.consecutive_wins - a.consecutive_wins || b.games_played - a.games_played)
    .slice(0, 6);

  const getPlayer = (id: string) => registrations.find(r => r.id === id);

  const loadSessions = useCallback(async () => {
    if (!isSupabaseEnabled || !supabase) return;
    const { data: courts } = await supabase.from('courts').select('id, name');
    const { data } = await supabase
      .from('open_play_sessions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (data) {
      const enriched = data.map((s: any) => ({
        ...s,
        court_name: courts?.find((c: any) => c.id === s.court_id)?.name ?? `Court ${s.court_id}`,
      }));
      setSessions(enriched);
      if (!selectedId && enriched.length > 0) setSelectedId(enriched[0].id);
    }
    setLoading(false);
  }, [selectedId]);

  const loadData = useCallback(async () => {
    if (!selectedId || !isSupabaseEnabled || !supabase) return;
    const [{ data: regs }, { data: games }] = await Promise.all([
      supabase.from('open_play_registrations').select('*').eq('session_id', selectedId).order('entered_pool_at').order('id', { ascending: true }), // Fix D
      supabase.from('open_play_games').select('*').eq('session_id', selectedId).in('status', ['rally', 'active']).order('started_at', { ascending: false }),
    ]);
    if (regs) setRegistrations(regs);
    if (games) {
      setActiveGame(games[0] ?? null);
      setNextGame(games[1] ?? null);
    }
  }, [selectedId]);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { if (selectedId) loadData(); }, [selectedId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!selectedId || !isSupabaseEnabled || !supabase) return;

    const gameChannel = supabase
      .channel(`live-game-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_play_games', filter: `session_id=eq.${selectedId}` },
        (payload: any) => {
          // Fix F: detect game-end transition and show winner announcement for 8s
          if (payload.eventType === 'UPDATE' &&
              payload.new?.status === 'ended' &&
              payload.old?.status !== 'ended' &&
              payload.new?.winner_team) {
            const winner: 'A' | 'B' = payload.new.winner_team;
            const winnerIds: string[] = winner === 'A' ? payload.new.team_a : payload.new.team_b;
            // Look up names from current registrations snapshot
            setRegistrations(currentRegs => {
              const names = winnerIds.map(
                (id: string) => currentRegs.find(r => r.id === id)?.player_name ?? 'Player'
              );
              setAnnouncement({
                winnerTeam: winner,
                winnerNames: names,
                scoreA: payload.new.score_a,
                scoreB: payload.new.score_b,
              });
              return currentRegs;
            });
            setTimeout(() => setAnnouncement(null), 8000);
          }
          loadData();
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_play_registrations', filter: `session_id=eq.${selectedId}` },
        () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(gameChannel); };
  }, [selectedId, loadData]);

  const getSide = (game: OPGame) => {
    const score = game.serving_team === 'A' ? game.score_a : game.score_b;
    return score % 2 === 0 ? 'Right' : 'Left';
  };

  const getServerName = (game: OPGame) => {
    if (!game.serving_team) return null;
    const ids = game.serving_team === 'A' ? game.team_a : game.team_b;
    return getPlayer(ids[game.server_index])?.player_name ?? null;
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a1a12] flex items-center justify-center">
      <div className="text-[#00694c] font-black text-lg animate-pulse">Loading Open Play…</div>
    </div>
  );

  if (sessions.length === 0) return (
    <div className="min-h-screen bg-[#0a1a12] flex flex-col items-center justify-center gap-4">
      <div className="text-5xl">🏓</div>
      <p className="text-white font-black text-xl">No Active Sessions</p>
      <p className="text-[#6b7280] text-sm">Check back when a session is started by the admin</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a1a12] text-white p-4 lg:p-6">

      {/* Fix F: Winner announcement overlay — auto-dismisses after 8 seconds */}
      {announcement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-[#0d2418] to-[#0a1a12] border-2 border-[#00694c] rounded-3xl p-10 text-center max-w-sm w-full mx-4 shadow-2xl animate-pulse-once">
            <div className="text-6xl mb-3">🏅</div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#00694c] mb-2">Game Over</p>
            <p className="text-4xl font-black text-white mb-1">
              {announcement.scoreA} – {announcement.scoreB}
            </p>
            <p className="text-[#00ff88] font-black text-xl mb-4">
              {announcement.winnerNames.join(' & ')} win!
            </p>
            <p className="text-[#4b5563] text-xs">Next match loading…</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[#00694c] font-black text-xs uppercase tracking-widest mb-0.5">☀ Sunshine Pickleball</div>
          <div className="font-black text-lg text-white">Open Play Live</div>
        </div>
        <div className="flex items-center gap-4">
          {/* Session switcher */}
          {sessions.length > 1 && (
            <div className="flex gap-2">
              {sessions.map(s => (
                <button key={s.id} onClick={() => setSelectedId(s.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    selectedId === s.id
                      ? 'bg-[#00694c] text-white border-[#00694c]'
                      : 'border-[#374151] text-[#6b7280] hover:border-[#00694c]'
                  }`}>
                  {s.court_name}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 bg-red-900/30 border border-red-500/40 rounded-full px-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Live</span>
            </div>
            <Clock />
          </div>
        </div>
      </div>

      {session && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* MAIN: Live Scoreboard */}
          <div className="lg:col-span-2 space-y-4">

            {/* Active Game Score */}
            {activeGame && activeGame.status !== 'ended' ? (
              <div className="bg-[#111c15] border border-[#00694c30] rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#1f2d22] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00694c]">
                      {session.court_name} · Match in Progress
                    </span>
                  </div>
                  <span className="text-[10px] text-[#4b5563] font-bold">First to {session.max_score} · Win by 2</span>
                </div>

                <div className="grid grid-cols-[1fr_100px_1fr] p-5 gap-4">
                  {/* Team A */}
                  <div className={`rounded-xl p-4 ${activeGame.serving_team === 'A' ? 'bg-[#0d2418] border border-[#00694c40]' : 'bg-[#0d1710]'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#4b5563]">Team A</span>
                      {activeGame.serving_team === 'A' && (
                        <span className="text-[8px] font-black bg-[#00694c] text-white px-1.5 py-0.5 rounded">SERVING</span>
                      )}
                    </div>
                    {activeGame.team_a.map((id, i) => {
                      const p = getPlayer(id);
                      const isServer = activeGame.serving_team === 'A' && activeGame.server_index === i;
                      return p ? (
                        <div key={id} className="mb-2">
                          <div className="flex items-center gap-2">
                            <TierDot tier={p.skill_tier} size="lg" />
                            <span className={`font-bold text-sm ${isServer ? 'text-[#00ff88]' : 'text-white'}`}>{p.player_name}</span>
                            {isServer && <span className="text-xs">🏓</span>}
                          </div>
                          {isServer && (
                            <div className="ml-5 text-[9px] text-[#00694c] font-bold mt-0.5">{getSide(activeGame)} side</div>
                          )}
                        </div>
                      ) : null;
                    })}
                  </div>

                  {/* Score */}
                  <div className="flex flex-col items-center justify-center">
                    <div className={`text-6xl font-black leading-none ${activeGame.score_a > activeGame.score_b ? 'text-[#00ff88]' : 'text-white'}`}>
                      {activeGame.score_a}
                    </div>
                    <div className="text-[#374151] text-2xl font-light my-1">–</div>
                    <div className={`text-6xl font-black leading-none ${activeGame.score_b > activeGame.score_a ? 'text-[#00ff88]' : 'text-white'}`}>
                      {activeGame.score_b}
                    </div>
                  </div>

                  {/* Team B */}
                  <div className={`rounded-xl p-4 ${activeGame.serving_team === 'B' ? 'bg-[#0d2418] border border-[#00694c40]' : 'bg-[#0d1710]'}`}>
                    <div className="flex items-center justify-end gap-2 mb-3">
                      {activeGame.serving_team === 'B' && (
                        <span className="text-[8px] font-black bg-[#00694c] text-white px-1.5 py-0.5 rounded">SERVING</span>
                      )}
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#4b5563]">Team B</span>
                    </div>
                    {activeGame.team_b.map((id, i) => {
                      const p = getPlayer(id);
                      const isServer = activeGame.serving_team === 'B' && activeGame.server_index === i;
                      return p ? (
                        <div key={id} className="mb-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isServer && <span className="text-xs">🏓</span>}
                            <span className={`font-bold text-sm ${isServer ? 'text-[#00ff88]' : 'text-white'}`}>{p.player_name}</span>
                            <TierDot tier={p.skill_tier} size="lg" />
                          </div>
                          {isServer && (
                            <div className="mr-5 text-[9px] text-[#00694c] font-bold mt-0.5">{getSide(activeGame)} side</div>
                          )}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Server info bar */}
                {activeGame.status === 'active' && getServerName(activeGame) && (
                  <div className="px-5 py-2 border-t border-[#1f2d22] text-center text-xs text-[#6b7280] font-semibold">
                    🏓 <span className="text-[#00ff88] font-bold">{getServerName(activeGame)}</span> is serving from the <span className="text-white font-bold">{getSide(activeGame)}</span> side
                  </div>
                )}
                {activeGame.status === 'rally' && (
                  <div className="px-5 py-2 border-t border-[#1f2d22] text-center text-xs text-amber-400 font-bold">
                    ⚡ Rally for serve in progress…
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#111c15] border border-[#1f2d22] rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">⏳</div>
                <p className="text-white font-black mb-1">Preparing Next Match</p>
                <p className="text-[#4b5563] text-sm">Stand by…</p>
              </div>
            )}

            {/* Up Next */}
            {nextGame && (
              <div className="bg-[#111c15] border border-[#1d4ed820] rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3">⏭ Up Next</div>
                <div className="grid grid-cols-[1fr_40px_1fr] gap-3 items-center">
                  <div className="space-y-1.5">
                    {nextGame.team_a.map(id => {
                      const p = getPlayer(id);
                      return p ? (
                        <div key={id} className="flex items-center gap-2">
                          <TierDot tier={p.skill_tier} />
                          <span className="text-sm font-semibold text-[#d1d5db]">{p.player_name}</span>
                          <span className="text-[9px] text-[#4b5563]">{TIER_LABEL[p.skill_tier]}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border border-[#374151] flex items-center justify-center text-[10px] font-black text-[#6b7280]">VS</div>
                  </div>
                  <div className="space-y-1.5">
                    {nextGame.team_b.map(id => {
                      const p = getPlayer(id);
                      return p ? (
                        <div key={id} className="flex items-center justify-end gap-2">
                          <span className="text-[9px] text-[#4b5563]">{TIER_LABEL[p.skill_tier]}</span>
                          <span className="text-sm font-semibold text-[#d1d5db]">{p.player_name}</span>
                          <TierDot tier={p.skill_tier} />
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Pool + Leaderboard */}
          <div className="space-y-4">

            {/* Waiting Pool */}
            <div className="bg-[#111c15] border border-[#1f2d22] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#6b7280]">⏳ Waiting Pool</span>
                <span className="text-xs font-black text-[#00694c] bg-[#00694c20] px-2 py-0.5 rounded-full">{waitingPool.length}</span>
              </div>
              {waitingPool.length === 0 ? (
                <p className="text-xs text-[#4b5563] text-center py-3">All players on court</p>
              ) : (
                <div className="space-y-2">
                  {waitingPool.map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between bg-[#0d1710] rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-[#374151] w-4">#{i + 1}</span>
                        <TierDot tier={r.skill_tier} />
                        <span className="text-sm font-semibold text-[#d1d5db]">{r.player_name}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        r.skill_tier === 'pro' ? 'bg-amber-900/40 text-amber-400' :
                        r.skill_tier === 'intermediate' ? 'bg-blue-900/40 text-blue-400' :
                        'bg-green-900/40 text-green-400'
                      }`}>{TIER_LABEL[r.skill_tier]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div className="bg-[#111c15] border border-[#f59e0b20] rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-3">🏆 Today's Leaders</div>
                <div className="space-y-2.5">
                  {leaderboard.map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-[#374151] w-4">{i + 1}</span>
                        <TierDot tier={r.skill_tier} />
                        <span className="text-sm font-semibold text-[#d1d5db]">{r.player_name}</span>
                      </div>
                      <span className="text-xs font-black text-[#00694c]">{r.games_played}G · {r.consecutive_wins}W</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Session info */}
            <div className="bg-[#111c15] border border-[#1f2d22] rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#6b7280] mb-2">Session</div>
              <p className="text-sm font-bold text-white">{session.court_name}</p>
              <p className="text-xs text-[#4b5563] mt-1">{session.date} · {session.start_time.slice(0,5)} – {session.end_time.slice(0,5)}</p>
              <p className="text-xs text-[#4b5563] capitalize mt-0.5">
                {session.skill_filter === 'all' ? 'All levels welcome' : `${session.skill_filter} only`} · First to 11 (deuce cap {session.max_score})
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
