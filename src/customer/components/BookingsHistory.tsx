import React, { useState, useEffect } from 'react';
import { Calendar, ClipboardList, PlusCircle, Search, ChevronRight, Bell, Tag, RefreshCw, Swords } from 'lucide-react';
import { Booking, Court } from '../types';
import { COURTS } from '../data';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';

interface BookingsHistoryProps {
  onNavigate: (screen: 'landing' | 'booking' | 'checkout' | 'confirmed' | 'bookings-list' | 'booking-detail') => void;
  bookings: Booking[];
  onViewDetail: (id: string) => void;
  onOpenLogin: () => void;
  role: 'user' | 'admin' | null;
  onLogout: () => void;
  currentUser?: { name: string; email: string; avatar?: string; } | null;
}

interface OPReg {
  id: string;
  session_id: string;
  skill_tier: string;
  status: string;
  registered_at: string;
  games_played: number;
  consecutive_wins: number;
  session?: {
    date: string;
    start_time: string;
    end_time: string;
    skill_filter: string;
    status: string;
    court_name?: string;
    session_type?: 'rotation' | 'round_robin';
  };
}

interface OPTeam {
  id: string;
  session_id: string;
  player1_name: string;
  player2_name: string;
  email: string | null;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  session?: {
    date: string;
    start_time: string;
    end_time: string;
    status: string;
    court_name?: string;
  };
}

export default function BookingsHistory({
  onNavigate,
  bookings: localBookings,
  onViewDetail,
  onOpenLogin,
  role,
  currentUser,
  onLogout,
}: BookingsHistoryProps) {
  const [activeFilterTab, setActiveFilterTab] = useState<'Upcoming' | 'Past' | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [supabaseBookings, setSupabaseBookings] = useState<Booking[] | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [openPlayRegs, setOpenPlayRegs] = useState<OPReg[]>([]);
  const [rrTeams, setRRTeams] = useState<OPTeam[]>([]);
  const [opFetching, setOpFetching] = useState(false);

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;

    const fetchBookings = async () => {
      setIsFetching(true);
      let query = supabase
        .from('bookings')
        .select('id, booking_ref, booking_date, start_time, end_time, court_name, customer_name, customer_phone, booking_status, payment_method, total_amount, created_at')
        .order('created_at', { ascending: false });

      if (currentUser?.email) {
        query = query.eq('customer_email', currentUser.email);
      }

      const { data, error } = await query;

      if (!error && data) {
        const statusMap: Record<string, Booking['status']> = {
          confirmed: 'Upcoming', paid: 'Upcoming',
          completed: 'Past', cancelled: 'Cancelled', pending: 'Pending' as any,
        };
        setSupabaseBookings(
          data.map((row) => {
            // Match court image by name
            const courtSlug = COURTS.find(c => c.name === row.court_name)?.id ?? 'court-1';
            return {
            id: row.booking_ref,
            courtId: courtSlug,
            courtName: row.court_name,
            date: row.booking_date,
            startTime: row.start_time?.slice(0, 5) ?? '09:00',
            endTime: row.end_time?.slice(0, 5) ?? '11:00',
            slots: [],
            price: Number(row.total_amount),
            status: statusMap[row.booking_status] ?? 'Upcoming',
            fullName: row.customer_name,
            phoneNumber: row.customer_phone ?? '',
            paymentMethod: (row.payment_method === 'card' ? 'Card' : row.payment_method === 'gcash' ? 'GCash' : 'Online Banking') as Booking['paymentMethod'],
            createdAt: row.created_at,
          };})
        );
      }
      setIsFetching(false);
    };

    fetchBookings();
  }, [currentUser?.email]);

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase || !currentUser?.email) return;
    setOpFetching(true);
    Promise.all([
      supabase.from('open_play_registrations')
        .select('id, session_id, skill_tier, status, registered_at, games_played, consecutive_wins')
        .eq('player_email', currentUser.email)
        .order('registered_at', { ascending: false }),
      supabase.from('open_play_teams')
        .select('id, session_id, player1_name, player2_name, email, wins, losses, points_for, points_against')
        .eq('email', currentUser.email)
        .order('created_at', { ascending: false }),
      supabase.from('open_play_sessions').select('id, date, start_time, end_time, skill_filter, status, court_id, session_type'),
      supabase.from('courts').select('id, name'),
    ]).then(([{ data: regs }, { data: teams }, { data: sessions }, { data: courts }]) => {
      if (regs) {
        setOpenPlayRegs(regs.map((r: any) => {
          const sess = sessions?.find((s: any) => s.id === r.session_id);
          const court = courts?.find((c: any) => c.id === sess?.court_id);
          return {
            ...r,
            session: sess ? { ...sess, court_name: court?.name ?? `Court ${sess.court_id}` } : undefined,
          };
        }));
      }
      if (teams) {
        setRRTeams(teams.map((t: any) => {
          const sess = sessions?.find((s: any) => s.id === t.session_id);
          const court = courts?.find((c: any) => c.id === sess?.court_id);
          return {
            ...t,
            session: sess ? { ...sess, court_name: court?.name ?? `Court ${sess.court_id}` } : undefined,
          };
        }));
      }
      setOpFetching(false);
    });
  }, [currentUser?.email]);

  // Use Supabase data when available, fall through to localStorage prop
  const bookings = supabaseBookings ?? localBookings;

  // Get matching court image thumbnail helper
  const getCourtImage = (courtId: string) => {
    const found = COURTS.find(c => c.id === courtId);
    return found ? found.image : 'https://images.unsplash.com/photo-1599586120429-48281b6f0ebb';
  };

  const getReadableSelectedDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getFormattedTimeLabel = (t: string) => {
    const [h, m] = t.split(':');
    const hourVal = parseInt(h);
    const suffix = hourVal >= 12 ? 'PM' : 'AM';
    const displayH = hourVal % 12 === 0 ? 12 : hourVal % 12;
    return `${displayH}:${m} ${suffix}`;
  };

  // Filter & Search Logic
  const filteredBookings = bookings.filter((booking) => {
    // 1. Tab Status Filter
    if (activeFilterTab === 'Upcoming' && booking.status !== 'Upcoming') return false;
    if (activeFilterTab === 'Past' && booking.status !== 'Past') return false;

    // 2. Search Query matches Court name or ID
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchName = booking.courtName.toLowerCase().includes(query);
      const matchId = booking.id.toLowerCase().includes(query);
      return matchName || matchId;
    }

    return true;
  });

  const handleOpenDetails = (id: string) => {
    onViewDetail(id);
  };

  if (!role) {
    return (
      <div className="bg-[#111412] min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#00694c] flex items-center justify-center">
          <ClipboardList className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">Sign in to see your bookings</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-xs">Your booking history is tied to your account. Log in to view, manage, or cancel reservations.</p>
        </div>
        <button
          onClick={onOpenLogin}
          className="bg-[#00694c] text-white font-bold text-sm uppercase tracking-wider px-8 py-3 rounded-xl hover:bg-[#005a40] transition-all"
        >
          Log in
        </button>
        <button onClick={() => onNavigate('landing')} className="text-slate-500 text-xs underline">Back to home</button>
      </div>
    );
  }

  return (
    <div className="bg-[#f9f9f7] min-h-screen font-sans flex flex-col">
      {/* Header Bar */}
      <header className="bg-[#111412] text-white sticky top-0 z-40 shadow-sm">
        <div className="h-[3px] bg-[#00694c]" />
        <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('landing')}>
          <div className="w-7 h-7 rounded-lg bg-[#00694c] flex items-center justify-center shrink-0">
            <span className="text-white font-black text-xs leading-none">S</span>
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight block">Sunshine <span className="font-medium text-white/50">Pickleball</span></span>
            <span className="font-mono text-[8px] uppercase tracking-widest text-[#6edba8] block font-semibold -mt-0.5">My Bookings</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {role ? (
            <div className="flex items-center gap-2">
              {currentUser?.avatar
                ? <img src={currentUser.avatar} referrerPolicy="no-referrer" className="w-7 h-7 rounded-full border border-slate-600 object-cover" />
                : <div className="w-7 h-7 rounded-full bg-[#00694c] flex items-center justify-center text-white text-[11px] font-bold">{currentUser?.name?.[0]?.toUpperCase() ?? 'U'}</div>
              }
              <span className="text-slate-300 text-xs hidden md:block max-w-[120px] truncate">{currentUser?.name}</span>
              <button onClick={onLogout} className="text-slate-400 hover:text-white py-1 px-2 bg-zinc-800/80 rounded text-xs">Sign out</button>
            </div>
          ) : (
            <button onClick={onOpenLogin} className="text-slate-300 hover:text-white font-mono text-xs uppercase tracking-wider py-1 px-3 border border-slate-600 hover:border-slate-400 rounded transition-colors">
              Log in
            </button>
          )}
          <button
            onClick={() => onNavigate('booking')}
            className="bg-[#00694c] text-white font-mono font-bold text-xs uppercase px-4 py-2 rounded-lg hover:bg-[#005a40] transition-all cursor-pointer"
          >
            + Book a court
          </button>
        </div>
        </div>
      </header>

      {/* Hero Welcome Banner */}
      <section className="bg-[#00694c] text-white py-8 px-6 border-b border-[#005a40]/30">
        <div className="max-w-7xl w-full mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] bg-white/20 text-white border border-white/30 font-mono font-bold px-2.5 py-1 rounded-full uppercase">
              Authenticated Profile
            </span>
            <h2 className="text-3xl font-sans font-black tracking-tight text-white mt-2 leading-tight flex items-center gap-3">
              My reservations
              {isFetching && <RefreshCw className="w-5 h-5 text-white/70 animate-spin" />}
            </h2>
            <p className="text-xs text-white/70 mt-1 leading-relaxed">
              Welcome back, {currentUser?.name ?? 'Player'}. Easily track schedules, cancel bookings, or download transaction receipts.
            </p>
          </div>

          <div className="flex gap-3 bg-white/15 p-4 rounded-xl border border-white/20 w-full md:w-auto text-xs">
            <div>
              <span className="block text-[9px] font-mono uppercase text-white/60">Upcoming Plays</span>
              <span className="block text-2xl font-black text-white mt-1">
                {bookings.filter(b => b.status === 'Upcoming').length} slots
              </span>
            </div>
            <div className="border-l border-white/20 pl-4">
              <span className="block text-[9px] font-mono uppercase text-white/60">Total Playtime</span>
              <span className="block text-2xl font-black text-white mt-1">
                {bookings.filter(b => b.status === 'Past').length * 2 + bookings.filter(b => b.status === 'Upcoming').length * 2} hrs
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main interactive dashboard */}
      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6 flex-1">

        {/* nothing here — tabs removed, content merged below */}

        {/* ── OPEN PLAY REGISTRATIONS ─────────────────────────────── */}
        {(openPlayRegs.length > 0 || rrTeams.length > 0 || opFetching) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-[#00694c]" />
              <span className="text-xs font-black uppercase tracking-widest text-[#00694c]">Open Play</span>
            </div>
            {opFetching ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <RefreshCw className="w-6 h-6 text-[#00694c] animate-spin mx-auto" />
              </div>
            ) : (
              <>
              {/* Round-Robin teams */}
              {rrTeams.map((team) => {
                const s = team.session;
                const isActive = s?.status === 'active';
                const isEnded = s?.status === 'ended';
                const diff = team.points_for - team.points_against;
                return (
                  <div key={team.id} className="bg-white rounded-2xl border border-purple-200 shadow-sm overflow-hidden">
                    <div className={`h-1 ${isActive ? 'bg-red-500' : isEnded ? 'bg-slate-300' : 'bg-purple-400'}`} />
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {isActive && (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Live Now
                            </span>
                          )}
                          {isEnded && <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Ended</span>}
                          {!isActive && !isEnded && <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Upcoming</span>}
                          <span className="text-[9px] font-black uppercase bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">🔵 Round-Robin</span>
                        </div>
                        <p className="font-extrabold text-slate-900 text-base">{s?.court_name ?? 'Open Play'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s?.date} · {s?.start_time?.slice(0,5)}–{s?.end_time?.slice(0,5)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Team: <span className="font-bold text-slate-700">{team.player1_name} &amp; {team.player2_name}</span>
                        </p>
                      </div>
                      {(team.wins + team.losses) > 0 && (
                        <div className="flex gap-4 text-center shrink-0">
                          <div>
                            <p className="text-2xl font-black text-[#00694c]">{team.wins}W</p>
                            <p className="text-[9px] font-mono uppercase text-slate-400">Wins</p>
                          </div>
                          <div>
                            <p className="text-2xl font-black text-slate-500">{team.losses}L</p>
                            <p className="text-[9px] font-mono uppercase text-slate-400">Losses</p>
                          </div>
                          <div>
                            <p className={`text-2xl font-black ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {diff >= 0 ? '+' : ''}{diff}
                            </p>
                            <p className="text-[9px] font-mono uppercase text-slate-400">Pt Diff</p>
                          </div>
                        </div>
                      )}
                      <div className="shrink-0">
                        {isActive ? (
                          <a href={`/open-play/live?session=${team.session_id}`}
                            className="flex items-center gap-1.5 bg-[#00694c] text-white text-xs font-black px-4 py-2.5 rounded-xl hover:bg-[#005a40] transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />Watch Live
                          </a>
                        ) : !isEnded ? (
                          <span className="text-xs text-slate-400 font-semibold">See you on {s?.date}!</span>
                        ) : (
                          <span className="text-xs text-slate-300 font-semibold">Tournament ended</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Open Play registrations (both rotation and RR pre-start) */}
              {openPlayRegs.map((reg) => {
                const s = reg.session;
                const isActive = s?.status === 'active';
                const isEnded = s?.status === 'ended';
                const isRRReg = s?.session_type === 'round_robin';
                const statusLabel = reg.status === 'playing' ? 'On Court' : reg.status === 'done' ? 'Done' : isRRReg && !isActive ? 'Registered' : 'Waiting';
                const statusColor = reg.status === 'playing' ? 'bg-green-100 text-green-700' : reg.status === 'done' ? 'bg-slate-100 text-slate-500' : isRRReg ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700';
                return (
                  <div key={reg.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border ${isRRReg ? 'border-purple-200' : 'border-slate-200'}`}>
                    <div className={`h-1 ${isActive ? 'bg-red-500' : isEnded ? 'bg-slate-300' : isRRReg ? 'bg-purple-400' : 'bg-[#00694c]'}`} />
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Session info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {isActive && (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Live Now
                            </span>
                          )}
                          {isEnded && <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Ended</span>}
                          {!isActive && !isEnded && <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isRRReg ? 'bg-purple-100 text-purple-700' : 'bg-[#00694c]/10 text-[#00694c]'}`}>Upcoming</span>}
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                          {isRRReg && <span className="text-[9px] font-black uppercase bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">🔵 Round-Robin</span>}
                        </div>
                        <p className="font-extrabold text-slate-900 text-base">{s?.court_name ?? 'Open Play'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {s?.date} · {s?.start_time?.slice(0,5)}–{s?.end_time?.slice(0,5)}
                          {!isRRReg && <span className="ml-2 capitalize">{s?.skill_filter === 'all' ? '· All levels' : `· ${s?.skill_filter} only`}</span>}
                        </p>
                        {isRRReg && !isActive ? (
                          <p className="text-xs text-purple-500 mt-0.5 font-semibold">Teams are formed automatically when the session starts</p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Registered {new Date(reg.registered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' · '}<span className="capitalize">{reg.skill_tier}</span>
                          </p>
                        )}
                      </div>

                      {/* Stats */}
                      {(reg.games_played > 0) && (
                        <div className="flex gap-4 text-center shrink-0">
                          <div>
                            <p className="text-2xl font-black text-slate-900">{reg.games_played}</p>
                            <p className="text-[9px] font-mono uppercase text-slate-400">Games</p>
                          </div>
                          <div>
                            <p className="text-2xl font-black text-[#00694c]">{reg.consecutive_wins}</p>
                            <p className="text-[9px] font-mono uppercase text-slate-400">Win streak</p>
                          </div>
                        </div>
                      )}

                      {/* CTA */}
                      <div className="shrink-0">
                        {isActive ? (
                          <a href={`/open-play/live?session=${reg.session_id}`}
                            className="flex items-center gap-1.5 bg-[#00694c] text-white text-xs font-black px-4 py-2.5 rounded-xl hover:bg-[#005a40] transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />Watch Live
                          </a>
                        ) : !isEnded ? (
                          <span className="text-xs text-slate-400 font-semibold">See you on {s?.date}!</span>
                        ) : (
                          <span className="text-xs text-slate-300 font-semibold">Session ended</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </>
            )}
          </div>
        )}

        {/* ── COURT BOOKINGS ───────────────────────────────────────── */}
        <>
        {/* Filter Controls Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          {/* Status Tabs */}
          <div className="flex gap-1.5 border-r border-slate-100 pr-4">
            {(['All', 'Upcoming', 'Past'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilterTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                  activeFilterTab === tab
                    ? 'bg-[#00694c] text-white shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Court Name or Reservation ID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-[#00694c] focus:ring-1 focus:ring-[#00694c] outline-none transition-all"
            />
          </div>
        </div>

        {/* List of Court Reservation Cards */}
        {filteredBookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                onClick={() => handleOpenDetails(booking.id)}
              >
                {/* Upper part */}
                <div>
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={getCourtImage(booking.courtId)}
                      alt={booking.courtName}
                      className="w-full h-full object-cover object-center scale-102 hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Status Absolute overlay Tag */}
                    <div className="absolute top-3 right-3">
                      {booking.status === 'Upcoming' && (
                        <span className="text-[10px] bg-[#e8f5ee] text-[#003d2b] font-mono font-black uppercase px-2.5 py-1 rounded-full border border-[#00694c]/30 shadow-sm">
                          ● Upcoming
                        </span>
                      )}
                      {booking.status === 'Past' && (
                        <span className="text-[10px] bg-slate-200 text-slate-700 font-mono font-bold uppercase px-2.5 py-1 rounded-full shadow-sm">
                          Past Play
                        </span>
                      )}
                      {booking.status === 'Cancelled' && (
                        <span className="text-[10px] bg-[#BA1A1A] text-white font-mono font-bold uppercase px-2.5 py-1 rounded-full shadow-sm">
                          Cancelled
                        </span>
                      )}
                      {(booking.status as any) === 'Pending' && (
                        <span className="text-[10px] bg-amber-500 text-white font-mono font-bold uppercase px-2.5 py-1 rounded-full shadow-sm">
                          ⏳ Pending
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs text-white px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase">
                      ID: #{booking.id}
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <h3 className="font-sans font-extrabold text-slate-900 text-base leading-tight">
                      {booking.courtName}
                    </h3>
                    
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <p className="flex justify-between">
                        <span className="font-mono text-slate-400 text-[10px] uppercase">Schedule Date</span>
                        <span className="font-semibold text-slate-800">{getReadableSelectedDate(booking.date)}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="font-mono text-slate-400 text-[10px] uppercase">Block Time</span>
                        <span className="font-semibold text-slate-900 font-mono">
                          {getFormattedTimeLabel(booking.startTime)} - {getFormattedTimeLabel(booking.endTime)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer block */}
                <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">TOTAL COST</span>
                    <span className="text-sm font-mono font-bold text-slate-900 leading-none">₱{booking.price}.00</span>
                  </div>

                  <button className="flex items-center gap-1 font-mono text-xs font-bold uppercase text-[#00694c] hover:text-[#005a40] hover:underline cursor-pointer">
                    View Receipt <ChevronRight className="w-4.5 h-4.5 text-[#00694c]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-4">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-sans font-bold text-slate-900">No Reservations Found</h3>
            <p className="text-xs text-slate-500 leading-normal">
              No matching booking details were recorded under these query parameters. Book a new court to get playing right away!
            </p>
            <button
              onClick={() => onNavigate('booking')}
              className="px-5 py-2.5 bg-[#00694c] text-white font-mono text-xs font-bold uppercase rounded-lg hover:bg-[#005a40] transition-all cursor-pointer"
            >
              Start New Booking
            </button>
          </div>
        )}
        </>

      </div>
    </div>
  );
}
