import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import { CurrentUser } from '../../App';

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
  const [tier, setTier] = useState<Tier | null>(null);
  const [walkinName, setWalkinName] = useState('');
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

  const handleSubmit = async () => {
    if (!tier || !session || !supabase) return;
    const name = currentUser?.name ?? walkinName.trim();
    if (!name) { setError('Please enter your name.'); return; }
    setSubmitting(true);
    setError(null);

    // Guest dedup: check if a walk-in with this name already exists in the session
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

    // Fix C: set entered_pool_at explicitly so queue ordering never silently
    // depends on whether the DB column has a DEFAULT configured.
    const { error: err } = await supabase.from('open_play_registrations').insert({
      session_id: session.id,
      player_name: name,
      player_email: currentUser?.email ?? null,
      skill_tier: tier,
      is_walkin: !currentUser,
      status: 'waiting',
      entered_pool_at: new Date().toISOString(),
    });

    if (err) {
      // Handle DB-level unique constraint violation gracefully
      const msg = err.code === '23505'
        ? `"${name}" is already registered for this session.`
        : err.message;
      setError(msg);
      setSubmitting(false);
    } else {
      setDone(true);
    }
  };

  // Guest users can still walk in — no login required

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

  const isFull = session.player_cap !== null && playerCount >= session.player_cap;

  // ── Already registered ──────────────────────────────────────────────────────
  if (alreadyRegistered) {
    return (
      <div className="min-h-screen bg-[#0a1a12] flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-6xl">✅</div>
        <h1 className="text-white font-black text-2xl text-center">You're already in!</h1>
        <p className="text-[#6b7280] text-sm text-center">You're registered for Open Play on <span className="text-white font-bold">{session.court_name}</span> — {session.date} at {session.start_time.slice(0,5)}.</p>
        {session.status === 'active' && (
          <a href="/open-play/live" className="bg-[#00694c] text-white font-black px-8 py-3.5 rounded-xl hover:bg-[#005a40] transition-colors flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Watch Live →
          </a>
        )}
        <button onClick={() => navigate('/')} className="text-[#4b5563] text-sm hover:text-white transition-colors">← Back to Home</button>
      </div>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-[#0a1a12] flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-20 h-20 rounded-full bg-[#00694c]/20 border-2 border-[#00694c] flex items-center justify-center text-4xl">🏓</div>
        <h1 className="text-white font-black text-3xl text-center">You're in!</h1>
        <p className="text-[#9ca3af] text-sm text-center max-w-sm">
          <span className="text-white font-bold">{currentUser?.name ?? walkinName}</span> is registered for Open Play on{' '}
          <span className="text-[#00ff88] font-bold">{session.court_name}</span> — {session.date} at {session.start_time.slice(0,5)}.
          Show up and you'll be added to the pool!
        </p>
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

  // ── Registration form ───────────────────────────────────────────────────────
  const skillOk = session.skill_filter === 'all' || tier === session.skill_filter;

  return (
    <div className="min-h-screen bg-[#0a1a12] text-white flex flex-col items-center justify-start pt-10 px-4 pb-16">
      {/* Back */}
      <div className="w-full max-w-lg mb-6">
        <button onClick={() => navigate('/')} className="text-[#4b5563] text-sm hover:text-white transition-colors flex items-center gap-1.5">
          ← Back
        </button>
      </div>

      {/* Session card */}
      <div className="w-full max-w-lg bg-[#111c15] border border-[#00694c30] rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${session.status === 'active' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#00694c]/20 text-[#00ff88] border border-[#00694c]/30'}`}>
            {session.status === 'active' ? '🔴 Live Now' : '📅 Upcoming'}
          </span>
          {isFull && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-red-900/30 text-red-400 border border-red-500/30">Full</span>}
        </div>
        <h2 className="text-lg font-black text-white mb-0.5">{session.court_name}</h2>
        <p className="text-[#6b7280] text-sm">{session.date} · {session.start_time.slice(0,5)} – {session.end_time.slice(0,5)}</p>
        <p className="text-[#4b5563] text-xs mt-1 capitalize">
          {session.skill_filter === 'all' ? 'All skill levels welcome' : `${session.skill_filter} players only`}
          {session.player_cap && ` · ${playerCount}/${session.player_cap} registered`}
        </p>
      </div>

      {isFull ? (
        <div className="w-full max-w-lg bg-[#1a1010] border border-red-500/20 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">😔</div>
          <p className="text-white font-black text-lg mb-2">Session is full</p>
          <p className="text-[#6b7280] text-sm">This session has reached its player cap. Check back for future sessions.</p>
        </div>
      ) : (
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

          {/* Skill tier */}
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

          {/* Wait time advisory */}
          {waitingCount >= 4 && (() => {
            const gamesAhead = Math.floor(waitingCount / 4);
            const minsLow = gamesAhead * 12;
            const minsHigh = gamesAhead * 18;
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
            onClick={handleSubmit}
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
