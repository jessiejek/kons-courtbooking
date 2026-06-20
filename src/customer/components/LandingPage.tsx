import React, { useState, useEffect } from 'react';
import { useRealtimeAnnouncements } from '../../hooks/useRealtimeAnnouncements';
import { COURTS as STATIC_COURTS } from '../data';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import {
  Calendar, MapPin, Phone, Clock, ArrowRight, ChevronRight,
  Star, Shield, Zap, Users, CheckCircle, Menu, X as XIcon
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (screen: 'landing' | 'booking' | 'checkout' | 'confirmed' | 'bookings-list' | 'booking-detail') => void;
  onOpenTechModal: () => void;
  onOpenLogin: () => void;
  role: 'user' | 'admin' | null;
  onLogout: () => void;
  currentUser?: { name: string; email: string; avatar?: string; } | null;
}

interface LiveCourt {
  slug: string;
  name: string;
  surface_type: string;
  default_price: number;
  status: string;
}

const STEPS = [
  { num: '01', title: 'Pick Your Court & Date', desc: 'Browse all four courts, check live availability, and lock in your preferred date in seconds.' },
  { num: '02', title: 'Select Your Time Slots', desc: 'Build a custom playing block — 1 hour to a full day. Slots are held for 10 minutes while you check out.' },
  { num: '03', title: 'Pay & Confirm', desc: 'Secure checkout via Card, GCash, or Online Banking. Instant booking confirmation sent to your phone.' },
];

const TESTIMONIALS = [
  { name: 'Coach Oliver R.', role: 'National Competitor', quote: 'The court cushioning here is unlike anything else in the country. My knees feel great even after three straight matches.', stars: 5 },
  { name: 'Ana Bonifacio', role: 'Weekend Player', quote: 'Booking took less than two minutes. The online system is clean, fast, and the courts are always well-maintained.', stars: 5 },
  { name: 'Team Raqueta PH', role: 'Club League', quote: 'We host our entire league schedule here. The night lighting on Court 2 is stadium-quality. Zero complaints.', stars: 5 },
];

export default function LandingPage({ onNavigate, onOpenTechModal, onOpenLogin, role, onLogout, currentUser }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  const [liveCourts, setLiveCourts] = useState<LiveCourt[]>([]);
  const [openPlaySessions, setOpenPlaySessions] = useState<{ id: string; court_name: string; date: string; start_time: string; end_time: string; skill_filter: string; status: string; session_type: 'rotation' | 'round_robin' }[]>([]);
  const [openPlayIndex, setOpenPlayIndex] = useState(0);
  const [openPlayDismissed, setOpenPlayDismissed] = useState(false);
  const openPlaySession = openPlaySessions[openPlayIndex] ?? null;
  const liveAnnouncements = useRealtimeAnnouncements();
  const visibleAnnouncements = liveAnnouncements.filter((a) => !dismissedAnnouncements.has(a.id));

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    supabase.from('courts').select('slug, name, surface_type, default_price, status').neq('status', 'inactive').order('id')
      .then(({ data }) => { if (data) setLiveCourts(data as LiveCourt[]); });
  }, []);

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    Promise.all([
      supabase.from('open_play_sessions')
        .select('id, court_id, date, start_time, end_time, skill_filter, status, session_type')
        .in('status', ['upcoming', 'active'])
        .order('status', { ascending: true }) // active first
        .order('date', { ascending: true }),
      supabase.from('courts').select('id, name'),
    ]).then(([{ data, error }, { data: courts }]) => {
      if (error) { console.error('[OpenPlay banner]', error); return; }
      if (!data || data.length === 0) return;
      setOpenPlaySessions(data.map((s: any) => ({
        ...s,
        court_name: courts?.find((c: any) => c.id === s.court_id)?.name ?? `Court ${s.court_id}`,
      })));
    });
  }, []);

  // Merge live data over static (for images + ratings which aren't in DB)
  const COURTS = (liveCourts.length > 0 ? liveCourts : STATIC_COURTS.map(c => ({
    slug: c.id, name: c.name, surface_type: c.type.toLowerCase(), default_price: c.pricePerHour, status: 'active',
  }))).map(lc => {
    const stat = STATIC_COURTS.find(c => c.id === lc.slug) ?? STATIC_COURTS[0];
    return {
      slug: lc.slug,
      name: lc.name,
      tag: lc.surface_type === 'indoor' ? 'Indoor' : 'Outdoor',
      price: `₱${lc.default_price}/hr`,
      rating: stat.rating.toString(),
      desc: stat.description,
      img: stat.image,
      status: lc.status,
    };
  });

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="bg-[#f9f9f7] text-[#1a1c1b] min-h-screen font-sans overflow-x-hidden">

      {/* ── STICKY NAV ─────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.08)]'
          : 'bg-[#111412]'
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between" style={{ height: '72px' }}>

          {/* Logo */}
          <button onClick={() => onNavigate('landing')} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#00694c] flex items-center justify-center shadow-md shrink-0">
              <span className="text-white font-black text-sm leading-none">S</span>
            </div>
            <span className={`font-extrabold text-base tracking-tight transition-colors ${scrolled ? 'text-[#1a1c1b]' : 'text-white'}`}>
              Sunshine <span className={`font-medium ${scrolled ? 'text-[#6d7a73]' : 'text-white/60'}`}>Pickleball</span>
            </span>
          </button>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {['Courts', 'Amenities', 'How It Works', 'About'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                className={`text-[11px] font-semibold uppercase tracking-wider transition-colors hover:text-[#00694c] ${
                  scrolled ? 'text-[#3d4943]' : 'text-white/85'
                }`}
              >
                {item}
              </a>
            ))}
            <button
              onClick={() => onNavigate('bookings-list')}
              className={`text-[11px] font-semibold uppercase tracking-wider transition-colors hover:text-[#00694c] ${
                scrolled ? 'text-[#3d4943]' : 'text-white/85'
              }`}
            >
              My Bookings
            </button>
          </nav>

          {/* CTA cluster */}
          <div className="flex items-center gap-2">
            {/* Desktop: full user info */}
            {role ? (
              <div className="hidden md:flex items-center gap-2.5">
                {currentUser?.avatar
                  ? <img src={currentUser.avatar} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border-2 border-[#00694c]/30 object-cover" />
                  : <div className="w-8 h-8 rounded-full bg-[#00694c] flex items-center justify-center text-white text-xs font-bold">{currentUser?.name?.[0]?.toUpperCase() ?? 'U'}</div>
                }
                <span className={`text-xs font-medium max-w-[110px] truncate ${scrolled ? 'text-[#3d4943]' : 'text-white/85'}`}>{currentUser?.name}</span>
                <button onClick={onLogout} className={`text-[11px] font-semibold uppercase tracking-wider transition-colors hover:text-red-500 ${scrolled ? 'text-[#6d7a73]' : 'text-white/60'}`}>
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className={`hidden md:block text-[11px] font-semibold uppercase tracking-wider px-4 py-2 rounded-lg border transition-all ${
                  scrolled
                    ? 'border-[#bccac1] text-[#3d4943] hover:border-[#00694c] hover:text-[#00694c]'
                    : 'border-white/40 text-white hover:bg-white/10'
                }`}
              >
                Log in
              </button>
            )}

            <button
              onClick={() => onNavigate('booking')}
              className="bg-[#00694c] hover:bg-[#005a40] text-white text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
            >
              Book a Court
            </button>

            {/* Mobile only: hamburger (includes login/signout inside dropdown) */}
            <button
              className={`md:hidden p-1.5 rounded-lg transition-colors ${scrolled ? 'text-[#1a1c1b] hover:bg-[#f0f0ee]' : 'text-white hover:bg-white/10'}`}
              onClick={() => setMobileMenuOpen(v => !v)}
            >
              {mobileMenuOpen ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-[#eeeeec] px-6 py-5 space-y-1 shadow-lg">
            {['Courts', 'Amenities', 'How It Works', 'About'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-semibold text-[#3d4943] uppercase tracking-wider py-2.5 border-b border-[#f0f0ee]"
              >
                {item}
              </a>
            ))}
            <button onClick={() => { onNavigate('bookings-list'); setMobileMenuOpen(false); }}
              className="block text-sm font-semibold text-[#3d4943] uppercase tracking-wider py-2.5 border-b border-[#f0f0ee] w-full text-left">
              My Bookings
            </button>
            {role ? (
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-2.5">
                  {currentUser?.avatar
                    ? <img src={currentUser.avatar} referrerPolicy="no-referrer" className="w-7 h-7 rounded-full object-cover" />
                    : <div className="w-7 h-7 rounded-full bg-[#00694c] flex items-center justify-center text-white text-xs font-bold">{currentUser?.name?.[0]?.toUpperCase() ?? 'U'}</div>
                  }
                  <span className="text-sm font-semibold text-[#1a1c1b] truncate max-w-[140px]">{currentUser?.name}</span>
                </div>
                <button onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                  className="text-xs font-bold text-red-500 uppercase tracking-wider">
                  Sign out
                </button>
              </div>
            ) : (
              <button onClick={() => { onOpenLogin(); setMobileMenuOpen(false); }}
                className="block text-sm font-bold text-[#00694c] uppercase tracking-wider pt-3 w-full text-left">
                Log in →
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── LIVE ANNOUNCEMENTS BANNER ──────────────────────────── */}
      {visibleAnnouncements.length > 0 && (
        <div className="fixed top-[72px] left-0 right-0 z-40">
          {visibleAnnouncements.map((a) => (
            <div
              key={a.id}
              className={`flex items-center justify-between gap-3 px-5 py-2.5 text-xs font-medium ${
                a.is_pinned
                  ? 'bg-[#00694c] text-white'
                  : 'bg-amber-50 text-amber-900 border-b border-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 max-w-7xl mx-auto w-full">
                {a.is_pinned && (
                  <span className="shrink-0 font-bold uppercase text-[10px] tracking-widest bg-white/20 px-2 py-0.5 rounded">
                    📌 Pinned
                  </span>
                )}
                <span className="font-semibold">{a.title}</span>
                {a.body && (
                  <span className={`hidden sm:inline truncate ${a.is_pinned ? 'opacity-75' : 'text-amber-700'}`}>
                    — {a.body}
                  </span>
                )}
              </div>
              <button
                onClick={() => setDismissedAnnouncements((s) => new Set([...s, a.id]))}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── OPEN PLAY BANNER ───────────────────────────────────── */}
      {openPlaySessions.length > 0 && !openPlayDismissed && (
        <div className="fixed top-[72px] left-0 right-0 z-39 bg-[#00694c] text-white">
          <div className="max-w-7xl mx-auto px-5 py-0 divide-y divide-white/10">
            {openPlaySessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {s.status === 'active' ? (
                    <span className="shrink-0 flex items-center gap-1 font-black text-[9px] uppercase tracking-widest bg-red-500/30 border border-red-400/40 px-2 py-0.5 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />Live
                    </span>
                  ) : (
                    <span className="shrink-0 flex items-center gap-1 font-black text-[9px] uppercase tracking-widest bg-white/15 px-2 py-0.5 rounded">
                      📅 {s.date}
                    </span>
                  )}
                  <span className="text-sm font-semibold truncate">
                    <span className="shrink-0 font-black text-[9px] uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded mr-2">Open Play</span>
                    🏓 {s.court_name} · {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}
                    <span className="ml-2 opacity-60 text-xs capitalize">
                      {s.session_type === 'round_robin' ? 'Round-Robin' : 'Rotation'}
                      {s.skill_filter && s.skill_filter !== 'all' ? ` · ${s.skill_filter}` : s.session_type === 'round_robin' ? ' · All' : ''}
                    </span>
                  </span>
                </div>
                <div className="shrink-0">
                  {s.status === 'active' ? (
                    <a href="/open-play/live"
                      className="bg-white text-[#00694c] text-xs font-black px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Watch Live →
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          sessionStorage.setItem('open_play_return', `/open-play/register?session=${s.id}`);
                          onOpenLogin();
                        } else {
                          window.location.href = `/open-play/register?session=${s.id}`;
                        }
                      }}
                      className="bg-white text-[#00694c] text-xs font-black px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors">
                      Register Now →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setOpenPlayDismissed(true)}
            className="absolute top-2 right-3 opacity-50 hover:opacity-100 transition-opacity">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuANh2metK2RGY6zJj7m3rPt1jjosoMQCgnn__ezAyuGW9OqJn8a9cWmVINMj-PdUWF-VoqXPadE9Q7kER9gXdhDfkRjNqe0ijZhnTxWshMBbR5vP7gq_PVqXEGdouelhiEkFedOzzYqITVfy81YodX9e5hXVzoPfEEGXN42woXMLnN9XOSWHXWLh1Lm0xEuPEYuZMCiPJnGJJ5YHL8oenhstsihEaNM3FxYwAg7NnAPkAzCgyMxnc4uRhF4-6PCnXKmOqQh8TBh9tXz"
            alt="Sunshine Pickleball Courts"
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
          {/* Strong gradient — dark top for nav + dark bottom for content */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/85" />
        </div>

        {/* Top green accent */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#00694c] z-10" />

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pt-40 pb-28">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80 px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-widest mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e87c] animate-pulse" />
            Bonifacio Global City, Taguig · Est. 2020
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[88px] font-extrabold text-white tracking-tight leading-[1.0] mb-6 max-w-5xl">
            Play at the{' '}
            <em className="not-italic text-[#6edba8]">Premier</em>
            <br />Pickleball Club
          </h1>

          <p className="text-base sm:text-lg text-white/65 max-w-xl leading-relaxed mb-10">
            Four professional-grade courts. Real-time online booking. Climate-controlled lounges.
            Sunshine Pickleball Courts — where every match feels like a championship.
          </p>

          {/* Open Play hero cards — one per court */}
          {openPlaySessions.length > 0 && (
            <div className="mb-6 flex flex-col gap-3 max-w-lg mx-auto w-full">
              {openPlaySessions.map(s => (
                <div key={s.id} className="bg-white/10 border border-[#00ff88]/30 backdrop-blur-sm rounded-2xl px-5 py-3.5 flex items-center gap-4">
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${s.status === 'active' ? 'bg-red-400' : 'bg-[#00ff88]'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#00ff88]">
                        Open Play · {s.status === 'active' ? 'Live Now' : s.date}
                      </span>
                    </div>
                    <p className="text-white font-bold text-sm truncate">{s.court_name} · {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</p>
                    <p className="text-white/60 text-xs capitalize">
                      {s.session_type === 'round_robin' ? 'Round-Robin' : 'Rotation'}
                      {s.skill_filter && s.skill_filter !== 'all' ? ` · ${s.skill_filter}` : s.session_type === 'round_robin' ? ' · All' : ''}
                    </p>
                  </div>
                  {s.status === 'active' ? (
                    <a href="/open-play/live"
                      className="shrink-0 bg-[#00ff88] text-[#003d2a] text-xs font-black px-4 py-2 rounded-xl hover:bg-[#00e87c] transition-colors flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />Watch Live
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          sessionStorage.setItem('open_play_return', `/open-play/register?session=${s.id}`);
                          onOpenLogin();
                        } else {
                          window.location.href = `/open-play/register?session=${s.id}`;
                        }
                      }}
                      className="shrink-0 bg-[#00ff88] text-[#003d2a] text-xs font-black px-4 py-2 rounded-xl hover:bg-[#00e87c] transition-colors">
                      {currentUser ? 'Register →' : 'Login →'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => onNavigate('booking')}
              className="inline-flex items-center justify-center gap-2.5 bg-[#00694c] hover:bg-[#005a40] text-white font-bold text-sm uppercase tracking-wider px-9 py-4 rounded-2xl shadow-2xl shadow-[#00694c]/40 transition-all active:scale-95"
            >
              <Calendar className="w-4 h-4" />
              Reserve a Court
            </button>
            <button
              onClick={() => onNavigate('bookings-list')}
              className="inline-flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold text-sm uppercase tracking-wider px-8 py-4 rounded-2xl backdrop-blur-sm transition-all active:scale-95"
            >
              My Bookings
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative z-10 bg-black/50 backdrop-blur-md border-t border-white/10">
          <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
            {[
              { value: COURTS.filter(c => c.status !== 'maintenance').length.toString(), label: 'Active Courts' },
              { value: `₱${Math.min(...COURTS.map(c => parseInt(c.price.replace(/\D/g, '')))).toLocaleString()}+`, label: 'Starting Rate / hr' },
              { value: '06:00–23:00', label: 'Daily Operations' },
              { value: '500+', label: 'Happy Players / Month' },
            ].map((s) => (
              <div key={s.label} className="py-5 px-6 text-center">
                <span className="block text-xl md:text-2xl font-extrabold text-white">{s.value}</span>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-white/45 mt-0.5">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COURTS GRID ────────────────────────────────────────── */}
      <section id="courts" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div>
              <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#00694c] bg-[#bbead4]/50 px-3 py-1 rounded-full mb-3">
                Our Facilities
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#1a1c1b] leading-tight tracking-tight">
                Four World-Class Courts
              </h2>
            </div>
            <button
              onClick={() => onNavigate('booking')}
              className="shrink-0 inline-flex items-center gap-2 text-sm font-bold text-[#00694c] hover:opacity-70 transition-opacity border-b-2 border-[#00694c] pb-0.5"
            >
              View availability <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {COURTS.map((court) => {
              const isMaintenance = court.status === 'maintenance';
              return (
                <div
                  key={court.slug}
                  className={`group bg-white rounded-2xl border overflow-hidden shadow-sm transition-all duration-300 ${
                    isMaintenance
                      ? 'border-amber-200 opacity-75 cursor-not-allowed'
                      : 'border-[#e8eeeb] hover:shadow-2xl hover:shadow-[#00694c]/10 hover:-translate-y-1 cursor-pointer'
                  }`}
                  onClick={() => !isMaintenance && onNavigate('booking')}
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={court.img}
                      alt={court.name}
                      className={`w-full h-full object-cover transition-transform duration-500 ${isMaintenance ? 'grayscale' : 'group-hover:scale-105'}`}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {isMaintenance ? (
                      <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500 text-white">
                        Maintenance
                      </span>
                    ) : (
                      <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                        court.tag === 'Indoor' ? 'bg-[#00694c] text-white' : 'bg-white/90 text-[#00694c]'
                      }`}>
                        {court.tag}
                      </span>
                    )}
                    <div className="absolute bottom-3 left-3 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-white text-xs font-bold">{court.rating}</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-[#1a1c1b] text-sm leading-tight">{court.name}</h3>
                      {isMaintenance
                        ? <span className="shrink-0 text-xs font-extrabold text-amber-500">Unavailable</span>
                        : <span className="shrink-0 text-xs font-extrabold text-[#00694c]">{court.price}</span>
                      }
                    </div>
                    <p className="text-xs text-[#6d7a73] leading-relaxed">{court.desc}</p>
                    <div className="pt-1">
                      {isMaintenance
                        ? <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-semibold">Under maintenance</span>
                        : <span className="inline-flex items-center gap-1 text-[#00694c] text-xs font-semibold group-hover:gap-2 transition-all">
                            Book this court <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                      }
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-[#111412]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#6edba8] bg-[#00694c]/20 px-3 py-1 rounded-full mb-4">
              Simple Process
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Book in Under 2 Minutes
            </h2>
            <p className="text-[#6d7a73] mt-4 max-w-xl mx-auto text-sm leading-relaxed">
              No phone calls, no waiting. Our real-time booking platform gets you on court fast.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative bg-white/[0.04] border border-white/8 rounded-2xl p-8 space-y-5 hover:border-[#00694c]/50 hover:bg-white/[0.06] transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-[#00694c] flex items-center justify-center shadow-lg shadow-[#00694c]/30">
                    <span className="text-white font-extrabold text-sm">{step.num}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:block flex-1 border-t border-dashed border-white/10" />
                  )}
                </div>
                <h3 className="font-extrabold text-white text-lg leading-tight">{step.title}</h3>
                <p className="text-[#6d7a73] text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <button
              onClick={() => onNavigate('booking')}
              className="inline-flex items-center gap-2.5 bg-[#00694c] hover:bg-[#005a40] text-white font-bold text-sm uppercase tracking-wider px-9 py-4 rounded-2xl shadow-xl shadow-[#00694c]/30 transition-all active:scale-95"
            >
              <Calendar className="w-4 h-4" /> Start Booking Now
            </button>
          </div>
        </div>
      </section>

      {/* ── FEATURES / WHY US ──────────────────────────────────── */}
      <section id="amenities" className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

          <div className="space-y-8">
            <div>
              <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#00694c] bg-[#bbead4]/50 px-3 py-1 rounded-full mb-4">
                Why Sunshine
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#1a1c1b] leading-tight tracking-tight">
                Built for<br />Serious Players
              </h2>
              <p className="text-[#3d4943] mt-4 text-sm leading-relaxed max-w-md">
                From the German-engineered Laykold cushion surface to the stadium-grade flood lighting, every detail at Sunshine is designed to elevate your game and protect your body.
              </p>
            </div>

            <div className="space-y-5">
              {[
                { icon: Shield, title: 'Laykold Cushion Surface', desc: 'Reduces joint impact by 22% vs. hard courts. Endorsed by national coaches.' },
                { icon: Zap, title: 'Instant Online Booking', desc: '10-minute cart hold. Real-time slot availability. Book from your phone in 90 seconds.' },
                { icon: Users, title: 'Private & Group Play', desc: 'Solo court rentals, corporate events, and league scheduling all in one platform.' },
                { icon: CheckCircle, title: 'Free Secure Parking', desc: 'On-premises covered parking for all registered players. No hidden fees.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#e8f5ee] flex items-center justify-center shrink-0">
                    <Icon className="w-4.5 h-4.5 text-[#00694c]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#1a1c1b]">{title}</p>
                    <p className="text-xs text-[#6d7a73] mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onOpenTechModal}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#00694c] border border-[#00694c]/30 px-5 py-2.5 rounded-xl hover:bg-[#00694c] hover:text-white hover:border-[#00694c] transition-all"
            >
              Learn about our surface tech <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 rounded-2xl overflow-hidden h-52 relative group">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDflRyAyRElrM8rqUnguE6w5PmIDC5BNVKVe0bK2Tvyur65W3kDqeD9BZ37gMDGwOQX7h_lBKS_nX-dCcPP6y9bH1G_4ZKqC3E6EoMnGP2uNZoOHIZ2tkLOd2ATN5Yr4PYQgEi2Kz27JdX571WJW8cicJV0XSV2YkN8djGsENzAwgU2En1WJYx_XW-fuxi3fIgq7eYLjcHnc395c1h8OmQ4xcv5vBh16-2rQJig0A5-uztkWoj8S7Jncfa2geNNzclHKVDu3I6t4pq0"
                alt="Championship outdoor court"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent flex items-end p-5">
                <div>
                  <p className="text-white font-extrabold text-base">Championship Outdoor Courts</p>
                  <p className="text-white/60 text-xs mt-0.5">Stadium lighting · Wind barriers · Open air</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden h-44 relative group">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYGSfmdA49eRR83lQsv1hN2gMHr8FG2ikTUmB_75urXgGquTYjSAENgNxTmOIHIy5WRrorIx6XDTt1GqOzxjZS5W--iheKIagmsOqNJF9ovBmYePaCf5F_Aer9lL3rYfbQi3p4SdIf4iLPyk_au1dr7TGCHv2WH1E_0O--uKGrKZ8XJ-8TmVcWpL0MLdqO0U_pevBDCuBKf8PgWtblYvWopZWLFFb6zhLgI-fuOY_n3o21fhIR3dCQ-ecUrX-h9jEroubarcpKg-0g"
                alt="Premium indoor court"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4">
                <p className="text-white font-bold text-sm">Premium Indoor</p>
              </div>
            </div>

            <div className="bg-[#00694c] rounded-2xl h-44 p-5 flex flex-col justify-between">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[#6edba8] text-[10px] font-bold uppercase tracking-wider mb-1">Operating Hours</p>
                <p className="text-white font-extrabold text-xl leading-tight">06:00 AM<br/>– 11:00 PM</p>
                <p className="text-white/50 text-[10px] mt-1">7 days a week · No holidays off</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────── */}
      <section id="about" className="py-24 px-6 bg-[#f0f4f1]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#00694c] bg-[#bbead4]/60 px-3 py-1 rounded-full mb-4">
              Player Reviews
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#1a1c1b] tracking-tight">
              Trusted by Metro Manila's Best
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl border border-[#dde8e2] p-7 shadow-sm flex flex-col gap-5">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-[#1a1c1b] leading-relaxed flex-1">"{t.quote}"</p>
                <div className="border-t border-[#f0f0ee] pt-4">
                  <p className="font-bold text-sm text-[#1a1c1b]">{t.name}</p>
                  <p className="text-xs text-[#6d7a73] mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="relative py-32 px-6 overflow-hidden bg-[#00694c]">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-black/10 blur-3xl" />

        <div className="relative max-w-3xl mx-auto text-center space-y-7">
          <h2 className="text-4xl md:text-6xl font-extrabold text-white leading-tight tracking-tight">
            Your Court is Waiting.
          </h2>
          <p className="text-[#a8d9be] text-base max-w-xl mx-auto leading-relaxed">
            Slots fill fast during peak hours. Reserve your court now — cancellation is free up to 24 hours before your session.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <button
              onClick={() => onNavigate('booking')}
              className="inline-flex items-center justify-center gap-2.5 bg-white text-[#00694c] hover:bg-[#f0f4f1] font-extrabold text-sm uppercase tracking-wider px-10 py-4 rounded-2xl shadow-2xl shadow-black/20 transition-all active:scale-95"
            >
              <Calendar className="w-4 h-4" /> Book a Court Now
            </button>
            <button
              onClick={() => onNavigate('bookings-list')}
              className="inline-flex items-center justify-center gap-2 border border-white/30 text-white hover:bg-white/10 font-bold text-sm uppercase tracking-wider px-8 py-4 rounded-2xl transition-all"
            >
              Manage Bookings <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer className="bg-[#111412] text-[#6d7a73] py-16 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/[0.06]">

          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00694c] flex items-center justify-center shrink-0">
                <span className="text-white font-black text-sm">S</span>
              </div>
              <span className="text-white font-extrabold text-base tracking-tight">
                Sunshine <span className="font-medium text-white/50">Pickleball</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed">
              Metro Manila's premier boutique pickleball facility. International-standard courts, real-time online booking, and a world-class player experience.
            </p>
          </div>

          <div>
            <h4 className="text-white text-[10px] font-extrabold uppercase tracking-widest mb-5">Location</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#00694c] shrink-0 mt-0.5" />
                <span>7th Ave. cor. 30th St., Bonifacio Global City, Taguig, Metro Manila</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white text-[10px] font-extrabold uppercase tracking-widest mb-5">Hours & Contact</h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#00694c] shrink-0" />
                <span>06:00 AM – 11:00 PM Daily</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#00694c] shrink-0" />
                <span>+63 (2) 8888-7777</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white text-[10px] font-extrabold uppercase tracking-widest mb-5">Quick Links</h4>
            <ul className="space-y-2.5 text-xs">
              {[
                ['Book a Court', () => onNavigate('booking')],
                ['My Bookings', () => onNavigate('bookings-list')],
                ['Court Technology', onOpenTechModal],
                ['24h Cancellation Policy', () => {}],
                ['Footwear Protocol', () => {}],
              ].map(([label, fn]) => (
                <li key={label as string}>
                  <button
                    onClick={fn as () => void}
                    className="hover:text-white transition-colors text-left"
                  >
                    {label as string}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px]">
          <p>© 2026 Sunshine Pickleball Courts. All Rights Reserved.</p>
          <div className="flex gap-6">
            <button className="hover:text-white transition-colors">Privacy Policy</button>
            <button className="hover:text-white transition-colors">Terms of Service</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
