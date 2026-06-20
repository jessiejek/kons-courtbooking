import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import { CurrentUser } from '../../App';
import { MINS_PER_GAME_LOW, MINS_PER_GAME_HIGH, PLAYERS_PER_MATCH } from '../../lib/openPlayMatchmaking';

interface Props {
  currentUser: CurrentUser | null;
  onOpenLogin: () => void;
}

interface OPSession {
  id: string;
  court_id: number;
  court_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  skill_filter: string;
  status: string;
  player_cap: number | null;
  session_type: 'rotation' | 'round_robin';
}

type Tier = 'beginner' | 'intermediate' | 'pro';

const TIER_INFO: { value: Tier; label: string; desc: string; color: string }[] = [
  { value: 'beginner',     label: 'Beginner',     desc: 'New to pickleball or still learning basics',         color: 'border-green-500  bg-green-500/10  text-green-400' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Comfortable with dinking, serves, and court play',    color: 'border-blue-500   bg-blue-500/10   text-blue-400'  },
  { value: 'pro',          label: 'Pro',           desc: 'Competitive player — strong 3rd shot, speed-ups',    color: 'border-amber-500  bg-amber-500/10  text-amber-400' },
];

export default function OpenPlayRegister({ currentUser, onOpenLogin }: Props) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session');

  const [session, setSession] = useState<OPSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Rotation fields
  const [tier, setTier] = useState<Tier | null>(null);
  const [walkinName, setWalkinName] = useState('');

  // Round-Robin fields
  const [p1Name, setP1Name] = useState(currentUser?.name ?? '');
  const [p2Name, setP2Name] = useState('');
  const [teamEmail, setTeamEmail] = useState(currentUser?.email ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);

  useEffect(() => {
    if (!sessionId || !isSupabaseEnabled || !supabase) { setLoadingSession(false); return; }

    Promise.all([
      supabase.from('open_play_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('courts').select('id, name'),
      supabase.from('open_play_registrations').select('id, player_email, status').eq('session_id', sessionId).neq('status', 'done'),
    ]).then(([{ data: s }, { data: courts }, { data: regs }]) => {
      if (s) {
        setSession({
          ...s,
          court_name: courts?.find((c: any) => c.id === s.court_id)?.name ?? `Court ${s.court_id}`,
        });
        setPlayerCount(regs?.length ?? 0);
        setWaitingCount(regs?.filter((r: any) => r.status === 'waiting').length ?? 0);
        if (currentUser?.email && regs?.some((r: any) => r.player_email === currentUser.email)) {
          setAlreadyRegistered(true);
        }
      }
      setLoadingSession(false);
    });
  }, [sessionId, currentUser]);

  // Fix H: keep wait advisory live via Realtime
  useEffect(() => {
    if (!sessionId || !isSupabaseEnabled || !supabase) return;
    const ch = supabase
      .channel(`register-advisory-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_play_registrations', filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data } = await supabase!
            .from('open_play_registrations')
            .select('id, status')
            .eq('session_id', sessionId)
            .neq('status', 'done');
          if (data) {
            setPlayerCount(data.length);
            setWaitingCount(data.filter((r: any) => r.status === 'waiting').length);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  const handleSubmitRotation = async () => {
    if (!tier || !session || !supabase) return;
    const name = currentUser?.name ?? walkinName.trim();
    if (!name) { setError('Please enter your name.'); return; }
    setSubmitting(true);
    setError(null);

    if (!currentUser) {
      const { data: existing } = await supabase
        .from('open_play_registrations')
        .select('id')
        .eq('session_id', session.id)
        .eq('is_walkin', true)
        .neq('status', 'done')
        .ilike('player_name', name)
        .maybeSingle();
      if (existing) {
        setError(`"${name}" is already registered for this session.`);
        setSubmitting(false);
        return;
      }
    }

    // Fix C: set entered_pool_at explicitly
    const { error: err } = await supabase.from('open_play_registrations').insert({
      session_id: session.id,
      player_name: name,
      player_email: currentUser?.email ?? null,
      skill_tier: tier,
      is_walkin: !currentUser,
      is_present: false, // Fix I: self-reg → false; admin marks present at check-in
      status: 'waiting',
      entered_pool_at: new Date().toISOString(),
    });

    if (err) {
      const msg = err.code === '23505'
        ? `"${name}" is already registered for this session.`
        : err.message;
      setError(msg);
      setSubmitting(false);
    } else {
      setDone(true);
    }
  };

  const handleSubmitRR = async () => {
    if (!session || !supabase) return;
    const p1 = p1Name.trim() || currentUser?.name?.trim() || '';
    const p2 = p2Name.trim();
    if (!p1) { setError('Enter player 1 name.'); return; }
    if (!p2) { setError("Enter your partner's name."); return; }
    setSubmitting(true);
    setError(null);

    const { error: err } = await supabase.from('open_play_teams').insert({
      session_id: session.id,
      player1_name: p1,
      player2_name: p2,
      email: teamEmail.trim() || currentUser?.email || null,
    });

    if (err) {
      setError(err.message);
      setSubmitting(false);
    } else {
      setDone(true);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#0a1a12] flex items-center justify-center">
        <div className="text-[#00694c] font-black text-lg animate-pulse">Loading session…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a1a12] flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl">❌</div>
        <p className="text-white font-black text-xl">Session not found</p>
        <button onClick={() => navigate('/')} className="text-[#00694c] font-bold hover:underline">← Back to Home</button>
      </div>
    );
  }

  if (session.status === 'ended') {
    return (
      <div className="min-h-screen bg-[#0a1a12] flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl">🏁</div>
        <p className="text-white font-black text-xl">This session has ended</p>
        <button onClick={() => navigate('/')} className="text-[#00694c] font-bold hover:underline">← Back to Home</button>
      </div>
    );
  }

  const isRR = session.session_type === 'round_robin';
  const isFull = session.player_cap !== null && playerCount >= session.player_cap;

  if (alreadyRegistered) {
    return (
      <div className="min-h-screen bg-[#0a1a12] flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-6xl">✅</div>
        <h1 className="text-white font-black text-2xl text-center">You're already in!</h1>
        <p className="text-[#6b7280] text-sm text-center">
          You're registered for Open Play on <span className="text-white font-bold">{session.court_name}</span> — {session.date} at {session.start_time.slice(0,5)}.
        </p>
        {session.status === 'active' && (
          <a href="/open-play/live" className="bg-[#00694c] text-white font-black px-8 py-3.5 rounded-xl hover:bg-[#005a40] transition-colors flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Watch Live →
          </a>
        )}
        <button onClick={() => navigate('/')} className="text-[#4b5563] text-sm hover:text-white transition-colors">← Back to Home</button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#0a1a12] flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-20 h-20 rounded-full bg-[#00694c]/20 border-2 border-[#00694c] flex items-center justify-center text-4xl">🏓</div>
        <h1 className="text-white font-black text-3xl text-center">You're in!</h1>
        {isRR ? (
          <p className="text-[#9ca3af] text-sm text-center max-w-sm">
            Team <span className="text-white font-bold">{p1Name} & {p2Name}</span> is registered for{' '}
            <span className="text-[#00ff88] font-bold">{session.court_name}</span> Round-Robin — {session.date} at {session.start_time.slice(0,5)}.
          </p>
        ) : (
          <p className="text-[#9ca3af] text-sm text-center max-w-sm">
            <span className="text-white font-bold">{currentUser?.name ?? walkinName}</span> is in the waiting pool for{' '}
            <span className="text-[#00ff88] font-bold">{session.court_name}</span> — {session.date} at {session.start_time.slice(0,5)}.
            Show up at the court and the admin will mark you present to enter the rotation.
          </p>
        )}
        <div className="flex gap-3">
          {session.status === 'active' && (
            <a href="/open-play/live" className="bg-[#00694c] text-white font-black px-6 py-3 rounded-xl hover:bg-[#005a40] transition-colors flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Watch Live
            </a>
          )}
          <button onClick={() => navigate('/')} className="border border-[#374151] text-[#9ca3af] font-bold px-6 py-3 rounded-xl hover:border-[#00694c] hover:text-white transition-colors">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1a12] text-white flex flex-col items-center justify-start pt-10 px-4 pb-16">
      <div className="w-full max-w-lg mb-6">
        <button onClick={() => navigate('/')} className="text-[#4b5563] text-sm hover:text-white transition-colors flex items-center gap-1.5">
          ← Back
        </button>
      </div>

      {/* Session card */}
      <div className="w-full max-w-lg bg-[#111c15] border border-[#00694c30] rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${
            session.status === 'active' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#00694c]/20 text-[#00ff88] border border-[#00694c]/30'
          }`}>
            {session.status === 'active' ? '🔴 Live Now' : '📅 Upcoming'}
          </span>
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${
            isRR ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'
          }`}>
            {isRR ? '🔵 Round-Robin' : '🟢 Rotation'}
          </span>
          {isFull && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-red-900/30 text-red-400 border border-red-500/30">Full</span>}
        </div>
        <h2 className="text-lg font-black text-white mb-0.5">{session.court_name}</h2>
        <p className="text-[#6b7280] text-sm">{session.date} · {session.start_time.slice(0,5)} – {session.end_time.slice(0,5)}</p>
        {!isRR && (
          <p className="text-[#4b5563] text-xs mt-1 capitalize">
            {session.skill_filter === 'all' ? 'All skill levels welcome' : `${session.skill_filter} players only`}
            {session.player_cap && ` · ${playerCount}/${session.player_cap} registered`}
          </p>
        )}
        {isRR && (
          <p className="text-[#4b5563] text-xs mt-1">
            Team tournament · {session.player_cap ? `${playerCount}/${session.player_cap} teams` : 'open team registration'}
          </p>
        )}
      </div>

      {isFull ? (
        <div className="w-full max-w-lg bg-[#1a1010] border border-red-500/20 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">😔</div>
          <p className="text-white font-black text-lg mb-2">Session is full</p>
          <p className="text-[#6b7280] text-sm">This session has reached its cap. Check back for future sessions.</p>
        </div>
      ) : isRR ? (
        /* ── Round-Robin team registration form ── */
        <div className="w-full max-w-lg">
          <h1 className="text-2xl font-black text-white mb-1">Register Your Team</h1>
          <p className="text-[#6b7280] text-sm mb-6">Enter both player names to register as a team for this Round-Robin.</p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#6b7280] mb-1.5">Player 1 (You)</label>
              <input
                value={p1Name}
                onChange={e => setP1Name(e.target.value)}
                placeholder={currentUser?.name ?? 'Your name'}
                className="w-full bg-[#1f2d22] border border-[#374151] text-white placeholder-[#4b5563] rounded-xl px-4 py-3 text-sm focus:border-[#00694c] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#6b7280] mb-1.5">Player 2 (Partner)</label>
              <input
                value={p2Name}
                onChange={e => setP2Name(e.target.value)}
                placeholder="Your partner's name"
                className="w-full bg-[#1f2d22] border border-[#374151] text-white placeholder-[#4b5563] rounded-xl px-4 py-3 text-sm focus:border-[#00694c] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#6b7280] mb-1.5">Team email (optional — for live updates)</label>
              <input
                type="email"
                value={teamEmail}
                onChange={e => setTeamEmail(e.target.value)}
                placeholder={currentUser?.email ?? 'contact@email.com'}
                className="w-full bg-[#1f2d22] border border-[#374151] text-white placeholder-[#4b5563] rounded-xl px-4 py-3 text-sm focus:border-[#00694c] focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">{error}</div>
          )}

          <button
            onClick={handleSubmitRR}
            disabled={submitting}
            className="w-full bg-[#00694c] hover:bg-[#005a40] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider py-4 rounded-xl transition-colors">
            {submitting ? 'Registering Team…' : 'Register Team →'}
          </button>
          {!currentUser && (
            <button onClick={onOpenLogin} className="w-full mt-3 text-[#00694c] text-xs hover:underline text-center block">
              Have an account? Login to link your results →
            </button>
          )}
        </div>
      ) : (
        /* ── Rotation individual registration form ── */
        <div className="w-full max-w-lg">
          <h1 className="text-2xl font-black text-white mb-1">Register for Open Play</h1>
          {currentUser ? (
            <p className="text-[#6b7280] text-sm mb-6">Registering as <span className="text-white font-bold">{currentUser.name}</span></p>
          ) : (
            <div className="mb-6">
              <p className="text-[#6b7280] text-sm mb-3">Walk-in? Enter your name to register.</p>
              <input
                type="text"
                value={walkinName}
                onChange={e => setWalkinName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-[#1f2d22] border border-[#374151] text-white placeholder-[#4b5563] rounded-xl px-4 py-3 text-sm focus:border-[#00694c] focus:outline-none mb-2"
              />
              <button onClick={onOpenLogin} className="text-[#00694c] text-xs hover:underline">Have an account? Login instead →</button>
            </div>
          )}

          <p className="text-[10px] font-black uppercase tracking-widest text-[#6b7280] mb-3">Select your skill level</p>
          <div className="space-y-3 mb-6">
            {TIER_INFO.map(t => {
              const disabled = session.skill_filter !== 'all' && t.value !== session.skill_filter;
              return (
                <button
                  key={t.value}
                  disabled={disabled}
                  onClick={() => !disabled && setTier(t.value)}
                  className={`w-full text-left rounded-xl border-2 px-5 py-4 transition-all ${
                    disabled
                      ? 'border-[#1f2d22] opacity-30 cursor-not-allowed'
                      : tier === t.value
                        ? t.color + ' border-2'
                        : 'border-[#1f2d22] hover:border-[#374151]'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-black text-sm ${tier === t.value && !disabled ? '' : 'text-[#d1d5db]'}`}>{t.label}</span>
                    {tier === t.value && <span className="text-[10px] font-black text-[#00ff88]">✓ Selected</span>}
                  </div>
                  <p className="text-xs text-[#6b7280] mt-1">{t.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Wait time advisory — uses centralized constants */}
          {waitingCount >= PLAYERS_PER_MATCH && (() => {
            const gamesAhead = Math.floor(waitingCount / PLAYERS_PER_MATCH);
            const minsLow = gamesAhead * MINS_PER_GAME_LOW;
            const minsHigh = gamesAhead * MINS_PER_GAME_HIGH;
            return (
              <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
                <span className="text-amber-400 text-lg leading-none mt-0.5">⏱</span>
                <div>
                  <p className="text-amber-300 text-xs font-black uppercase tracking-wider mb-0.5">Estimated wait</p>
                  <p className="text-amber-200 text-sm">
                    <span className="font-bold">{waitingCount} players</span> ahead of you —
                    roughly <span className="font-bold">{minsLow}–{minsHigh} min</span> before your first game.
                  </p>
                </div>
              </div>
            );
          })()}

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">{error}</div>
          )}

          <button
            onClick={handleSubmitRotation}
            disabled={!tier || submitting}
            className="w-full bg-[#00694c] hover:bg-[#005a40] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider py-4 rounded-xl transition-colors">
            {submitting ? 'Registering…' : 'Register Now →'}
          </button>
          <p className="text-center text-[#374151] text-xs mt-4">Show up at the court and the admin will add you to the active pool.</p>
        </div>
      )}
    </div>
  );
}
