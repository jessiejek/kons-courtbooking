import React, { useState, useEffect } from 'react';
import { useRealtimeAnnouncements } from '../../hooks/useRealtimeAnnouncements';
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

const COURTS = [
  {
    name: 'Court 1 — Premium Indoor',
    tag: 'Indoor',
    price: '₱300/hr',
    rating: '4.9',
    desc: 'Climate-controlled with Laykold cushion coating, zero-glare lighting, and tournament-spec nets.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAYGSfmdA49eRR83lQsv1hN2gMHr8FG2ikTUmB_75urXgGquTYjSAENgNxTmOIHIy5WRrorIx6XDTt1GqOzxjZS5W--iheKIagmsOqNJF9ovBmYePaCf5F_Aer9lL3rYfbQi3p4SdIf4iLPyk_au1dr7TGCHv2WH1E_0O--uKGrKZ8XJ-8TmVcWpL0MLdqO0U_pevBDCuBKf8PgWtblYvWopZWLFFb6zhLgI-fuOY_n3o21fhIR3dCQ-ecUrX-h9jEroubarcpKg-0g',
  },
  {
    name: 'Court 2 — Championship Outdoor',
    tag: 'Outdoor',
    price: '₱250/hr',
    rating: '4.8',
    desc: 'Open-air with premium mesh fencing, shadowless stadium lights, and wind-barrier panels.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDflRyAyRElrM8rqUnguE6w5PmIDC5BNVKVe0bK2Tvyur65W3kDqeD9BZ37gMDGwOQX7h_lBKS_nX-dCcPP6y9bH1G_4ZKqC3E6EoMnGP2uNZoOHIZ2tkLOd2ATN5Yr4PYQgEi2Kz27JdX571WJW8cicJV0XSV2YkN8djGsENzAwgU2En1WJYx_XW-fuxi3fIgq7eYLjcHnc395c1h8OmQ4xcv5vBh16-2rQJig0A5-uztkWoj8S7Jncfa2geNNzclHKVDu3I6t4pq0',
  },
  {
    name: 'Court 3 — Indoor Pro',
    tag: 'Indoor',
    price: '₱300/hr',
    rating: '4.7',
    desc: 'Fully ventilated competitive court built for league play. Dynamic cushioning, pro-grade net posts.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUXjgdDHxmwietk7x8EWlEnGVZ3EiJsJnH8HMd7cgeN3KZtYbntZdQhM9FNxlMDfFtJd7A9cePP1Xyl61Z2ejXjjmHmirpO0ig3oHiHBtUZbln_SAeaPVnn_i_rPP1sWqgOpwy3hJB2tGpIraoyS4kJ3FciJVH-b2uigFKyHMSahupCQEZZll4fYMo18UFiqX_0hge5NtUzYCFvJ30DMmxG4J8CNyksJ9z5ppCeVhJ5_wWFuam1bDY0-5LtZndfQqSyoRdQMN1Za0S',
  },
  {
    name: 'Court 4 — Outdoor Scenic',
    tag: 'Outdoor',
    price: '₱250/hr',
    rating: '4.6',
    desc: 'Lush greenery surround, non-slip textured surface, premium net posts, and night flood lighting.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJZO4uG4ciG-9HvpBeL4KWbg1MCIajfR4-2nvayr6fb-NcRDuvSKdOqcT8c6pcmhvDb2vn_xXmKPcw-t3B5O0eBEsyjTeYof6OqdvY9rI_RDmdN0D0hdxPX6Ng3peqxDDdCQCej3DorIPK9ahXnrrabwnpq1OEEDJ4Rj3dnNublvhAczHk1THJSFdkYTplh3rzIBjkLTftkdQNKJ6BMrw3WCNVUir_Uvyt2grrpYhbnDthy7Um5dHBAUh-kbc3d_aZ_n-SWqc_pPts',
  },
];

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
  const liveAnnouncements = useRealtimeAnnouncements();
  const visibleAnnouncements = liveAnnouncements.filter((a) => !dismissedAnnouncements.has(a.id));

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="bg-[#f9f9f7] text-[#1a1c1b] min-h-screen font-sans overflow-x-hidden">

      {/* ── STICKY NAV ─────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-[#bccac1]/40' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <button onClick={() => onNavigate('landing')} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-[#00694c] flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <span className="text-white font-black text-base leading-none">S</span>
            </div>
            <div className="leading-none">
              <span className={`font-extrabold text-sm uppercase tracking-tight block transition-colors ${scrolled ? 'text-[#1a1c1b]' : 'text-white'}`}>
                Sunshine
              </span>
              <span className="font-semibold text-[9px] uppercase tracking-widest text-[#00694c] block">
                Pickleball Courts
              </span>
            </div>
          </button>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-7">
            {['Courts', 'Amenities', 'How It Works', 'About'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                className={`text-xs font-semibold uppercase tracking-wider transition-colors hover:text-[#00694c] ${
                  scrolled ? 'text-[#3d4943]' : 'text-white/80'
                }`}
              >
                {item}
              </a>
            ))}
            <button
              onClick={() => onNavigate('bookings-list')}
              className={`text-xs font-semibold uppercase tracking-wider transition-colors hover:text-[#00694c] ${
                scrolled ? 'text-[#3d4943]' : 'text-white/80'
              }`}
            >
              My Bookings
            </button>
          </nav>

          {/* CTA cluster */}
          <div className="flex items-center gap-3">
            {role ? (
              <div className="hidden md:flex items-center gap-2">
                {currentUser?.avatar
                  ? <img src={currentUser.avatar} referrerPolicy="no-referrer" className="w-7 h-7 rounded-full border border-white/30 object-cover" />
                  : <div className="w-7 h-7 rounded-full bg-[#00694c] flex items-center justify-center text-white text-[11px] font-bold">{currentUser?.name?.[0]?.toUpperCase() ?? 'U'}</div>
                }
                <span className={`text-xs max-w-[100px] truncate ${scrolled ? 'text-[#3d4943]' : 'text-white/80'}`}>{currentUser?.name}</span>
                <button onClick={onLogout} className={`text-xs font-semibold transition-colors hover:text-[#00694c] ${scrolled ? 'text-[#3d4943]' : 'text-white/70'}`}>
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className={`hidden md:block text-xs font-semibold uppercase tracking-wider border px-4 py-2 rounded-lg transition-all ${
                  scrolled
                    ? 'border-[#bccac1] text-[#3d4943] hover:border-[#00694c] hover:text-[#00694c]'
                    : 'border-white/30 text-white hover:border-white'
                }`}
              >
                Log in
              </button>
            )}
            <button
              onClick={() => onNavigate('booking')}
              className="bg-[#00694c] hover:bg-[#005a40] text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              Book a Court
            </button>
            {/* Mobile menu toggle */}
            <button
              className={`md:hidden p-1 ${scrolled ? 'text-[#1a1c1b]' : 'text-white'}`}
              onClick={() => setMobileMenuOpen(v => !v)}
            >
              {mobileMenuOpen ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-[#bccac1]/40 px-6 py-4 space-y-3">
            {['Courts', 'Amenities', 'How It Works', 'About'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-semibold text-[#3d4943] uppercase tracking-wider py-1"
              >
                {item}
              </a>
            ))}
            <button onClick={() => { onNavigate('bookings-list'); setMobileMenuOpen(false); }}
              className="block text-sm font-semibold text-[#3d4943] uppercase tracking-wider py-1 w-full text-left">
              My Bookings
            </button>
            {role ? (
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  {currentUser?.avatar
                    ? <img src={currentUser.avatar} referrerPolicy="no-referrer" className="w-6 h-6 rounded-full object-cover" />
                    : <div className="w-6 h-6 rounded-full bg-[#00694c] flex items-center justify-center text-white text-[10px] font-bold">{currentUser?.name?.[0]?.toUpperCase() ?? 'U'}</div>
                  }
                  <span className="text-sm font-semibold text-[#1a1c1b] truncate max-w-[140px]">{currentUser?.name}</span>
                </div>
                <button onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                  className="text-sm font-semibold text-[#00694c] uppercase tracking-wider">
                  Sign out
                </button>
              </div>
            ) : (
              <button onClick={() => { onOpenLogin(); setMobileMenuOpen(false); }}
                className="block text-sm font-semibold text-[#00694c] uppercase tracking-wider py-1 w-full text-left">
                Log in
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── LIVE ANNOUNCEMENTS BANNER ──────────────────────────── */}
      {visibleAnnouncements.length > 0 && (
        <div className="relative z-40 mt-16 space-y-0">
          {visibleAnnouncements.map((a) => (
            <div
              key={a.id}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 text-xs ${
                a.is_pinned
                  ? 'bg-[#00694c] text-white'
                  : 'bg-amber-50 text-amber-900 border-b border-amber-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {a.is_pinned && (
                  <span className="shrink-0 font-bold uppercase text-[10px] tracking-widest opacity-70">
                    📌 Pinned
                  </span>
                )}
                <span className="font-semibold truncate">{a.title}</span>
                {a.body && (
                  <span className={`hidden sm:inline truncate ${a.is_pinned ? 'opacity-80' : 'text-amber-700'}`}>
                    — {a.body}
                  </span>
                )}
              </div>
              <button
                onClick={() => setDismissedAnnouncements((s) => new Set([...s, a.id]))}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5"
                aria-label="Dismiss"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        {/* BG image */}
        <div className="absolute inset-0">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuANh2metK2RGY6zJj7m3rPt1jjosoMQCgnn__ezAyuGW9OqJn8a9cWmVINMj-PdUWF-VoqXPadE9Q7kER9gXdhDfkRjNqe0ijZhnTxWshMBbR5vP7gq_PVqXEGdouelhiEkFedOzzYqITVfy81YodX9e5hXVzoPfEEGXN42woXMLnN9XOSWHXWLh1Lm0xEuPEYuZMCiPJnGJJ5YHL8oenhstsihEaNM3FxYwAg7NnAPkAzCgyMxnc4uRhF4-6PCnXKmOqQh8TBh9tXz"
            alt="Sunshine Pickleball Courts hero"
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
          {/* Layered gradient: dark bottom + slight green tint */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/80" />
          <div className="absolute inset-0 bg-[#00694c]/10" />
        </div>

        {/* Green top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#00694c] z-10" />

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pt-32 pb-24">

          <div className="inline-flex items-center gap-2 bg-[#00694c]/20 border border-[#00694c]/40 text-[#bbead4] px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-widest mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#bbead4] animate-pulse" />
            Bonifacio Global City, Taguig · Est. 2020
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-white tracking-tight leading-[1.0] mb-6 max-w-5xl">
            Play at the{' '}
            <span className="text-[#bbead4]">Premier</span>
            <br />Pickleball Club
          </h1>

          <p className="text-base sm:text-lg text-white/70 max-w-xl leading-relaxed mb-10 font-normal">
            Four professional-grade courts. Real-time online booking. Climate-controlled lounges.
            Sunshine Pickleball Courts — where every match feels like a championship.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => onNavigate('booking')}
              className="inline-flex items-center justify-center gap-2.5 bg-[#00694c] hover:bg-[#005a40] text-white font-bold text-sm uppercase tracking-wider px-8 py-4 rounded-2xl shadow-xl shadow-[#00694c]/30 hover:shadow-[#00694c]/50 transition-all active:scale-95"
            >
              <Calendar className="w-4 h-4" />
              Reserve a Court
            </button>
            <button
              onClick={() => onNavigate('bookings-list')}
              className="inline-flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold text-sm uppercase tracking-wider px-8 py-4 rounded-2xl backdrop-blur-sm transition-all active:scale-95"
            >
              My Bookings
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
            {[
              { value: '4', label: 'Premium Courts' },
              { value: '₱250+', label: 'Starting Rate / hr' },
              { value: '06:00–23:00', label: 'Daily Operations' },
              { value: '500+', label: 'Happy Players / Month' },
            ].map((s) => (
              <div key={s.label} className="py-5 px-6 text-center">
                <span className="block text-xl md:text-2xl font-extrabold text-white">{s.value}</span>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-white/50 mt-0.5">{s.label}</span>
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
              <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#00694c] bg-[#bbead4]/40 px-3 py-1 rounded-full mb-3">
                Our Facilities
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#1a1c1b] leading-tight tracking-tight">
                Four World-Class Courts
              </h2>
            </div>
            <button
              onClick={() => onNavigate('booking')}
              className="shrink-0 inline-flex items-center gap-2 text-sm font-bold text-[#00694c] border-b-2 border-[#00694c] pb-0.5 hover:opacity-70 transition-opacity"
            >
              View availability <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {COURTS.map((court) => (
              <div
                key={court.name}
                className="group bg-white rounded-2xl border border-[#bccac1]/40 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                onClick={() => onNavigate('booking')}
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={court.img}
                    alt={court.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                    court.tag === 'Indoor'
                      ? 'bg-[#00694c] text-white'
                      : 'bg-white/90 text-[#00694c]'
                  }`}>
                    {court.tag}
                  </span>
                  <div className="absolute bottom-3 left-3 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-white text-xs font-bold">{court.rating}</span>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-[#1a1c1b] text-sm leading-tight">{court.name}</h3>
                    <span className="shrink-0 text-xs font-extrabold text-[#00694c]">{court.price}</span>
                  </div>
                  <p className="text-xs text-[#6d7a73] leading-relaxed">{court.desc}</p>
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 text-[#00694c] text-xs font-semibold group-hover:gap-2 transition-all">
                      Book this court <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-[#1a1c1b]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#bbead4] bg-[#00694c]/30 px-3 py-1 rounded-full mb-3">
              Simple Process
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Book in Under 2 Minutes
            </h2>
            <p className="text-[#6d7a73] mt-4 max-w-xl mx-auto text-sm leading-relaxed">
              No phone calls, no waiting. Our real-time booking platform gets you on court fast.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(100%-1rem)] w-8 border-t-2 border-dashed border-[#00694c]/30 z-10" />
                )}
                <div className="bg-[#eeeeec]/5 border border-[#eeeeec]/10 rounded-2xl p-7 space-y-4 hover:border-[#00694c]/40 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-[#00694c] flex items-center justify-center shadow-lg shadow-[#00694c]/20">
                    <span className="text-white font-extrabold text-sm">{step.num}</span>
                  </div>
                  <h3 className="font-extrabold text-white text-lg leading-tight">{step.title}</h3>
                  <p className="text-[#6d7a73] text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button
              onClick={() => onNavigate('booking')}
              className="inline-flex items-center gap-2.5 bg-[#00694c] hover:bg-[#005a40] text-white font-bold text-sm uppercase tracking-wider px-8 py-4 rounded-2xl shadow-lg shadow-[#00694c]/30 transition-all active:scale-95"
            >
              <Calendar className="w-4 h-4" /> Start Booking Now
            </button>
          </div>
        </div>
      </section>

      {/* ── FEATURES / WHY US ──────────────────────────────────── */}
      <section id="amenities" className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          <div className="space-y-8">
            <div>
              <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#00694c] bg-[#bbead4]/40 px-3 py-1 rounded-full mb-3">
                Why Sunshine
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#1a1c1b] leading-tight tracking-tight">
                A Facility Built for Serious Players
              </h2>
              <p className="text-[#3d4943] mt-4 text-sm leading-relaxed">
                From the German-engineered Laykold cushion surface to the stadium-grade flood lighting, every detail at Sunshine is designed to elevate your game and protect your body.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { icon: Shield, title: 'Laykold Cushion Surface', desc: 'Reduces joint impact by 22% vs. hard courts. Endorsed by national coaches.' },
                { icon: Zap, title: 'Instant Online Booking', desc: '10-minute cart hold. Real-time slot availability. Book from your phone in 90 seconds.' },
                { icon: Users, title: 'Private & Group Play', desc: 'Solo court rentals, corporate events, and league scheduling all in one platform.' },
                { icon: CheckCircle, title: 'Free Secure Parking', desc: 'On-premises covered parking for all registered players. No hidden fees.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#bbead4]/60 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#00694c]" />
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
              className="inline-flex items-center gap-2 text-sm font-bold text-[#00694c] border border-[#00694c] px-5 py-2.5 rounded-xl hover:bg-[#00694c] hover:text-white transition-all"
            >
              Learn about our surface tech <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Amenities bento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 rounded-2xl overflow-hidden h-48 relative group">
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

            <div className="rounded-2xl overflow-hidden h-40 relative group">
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

            <div className="bg-[#00694c] rounded-2xl h-40 p-5 flex flex-col justify-between">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[#bbead4] text-[10px] font-semibold uppercase tracking-wider">Hours</p>
                <p className="text-white font-extrabold text-lg leading-tight">06:00 AM<br/>– 11:00 PM</p>
                <p className="text-white/60 text-[10px] mt-0.5">7 days a week</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────── */}
      <section id="about" className="py-24 px-6 bg-[#eeeeec]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#00694c] bg-[#bbead4]/60 px-3 py-1 rounded-full mb-3">
              Player Reviews
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#1a1c1b] tracking-tight">
              Trusted by Metro Manila's Best
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl border border-[#bccac1]/40 p-6 shadow-sm flex flex-col gap-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-[#1a1c1b] leading-relaxed flex-1">"{t.quote}"</p>
                <div className="border-t border-[#eeeeec] pt-3">
                  <p className="font-bold text-sm text-[#1a1c1b]">{t.name}</p>
                  <p className="text-xs text-[#6d7a73]">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="relative py-28 px-6 overflow-hidden bg-[#00694c]">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-black/10 blur-3xl" />

        <div className="relative max-w-3xl mx-auto text-center space-y-7">
          <h2 className="text-4xl md:text-6xl font-extrabold text-white leading-tight tracking-tight">
            Your Court is Waiting.
          </h2>
          <p className="text-[#bbead4] text-base max-w-xl mx-auto leading-relaxed">
            Slots fill fast during peak hours. Reserve your court now — cancellation is free up to 24 hours before your session.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => onNavigate('booking')}
              className="inline-flex items-center justify-center gap-2.5 bg-white text-[#00694c] hover:bg-[#f9f9f7] font-extrabold text-sm uppercase tracking-wider px-10 py-4 rounded-2xl shadow-xl transition-all active:scale-95"
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
      <footer className="bg-[#1a1c1b] text-[#6d7a73] py-16 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/5">

          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#00694c] flex items-center justify-center">
                <span className="text-white font-black text-base">S</span>
              </div>
              <div>
                <span className="block text-white font-extrabold text-sm uppercase tracking-tight">Sunshine</span>
                <span className="block text-[#00694c] text-[9px] font-semibold uppercase tracking-widest">Pickleball Courts</span>
              </div>
            </div>
            <p className="text-xs text-[#6d7a73] leading-relaxed">
              Metro Manila's premier boutique pickleball facility. International-standard courts, real-time online booking, and a world-class player experience.
            </p>
          </div>

          <div>
            <h4 className="text-white text-xs font-extrabold uppercase tracking-widest mb-4">Location</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#00694c] shrink-0 mt-0.5" />
                <span>7th Ave. cor. 30th St., Bonifacio Global City, Taguig, Metro Manila</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white text-xs font-extrabold uppercase tracking-widest mb-4">Hours & Contact</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#00694c]" />
                <span>06:00 AM – 11:00 PM Daily</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#00694c]" />
                <span>+63 (2) 8888-7777</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white text-xs font-extrabold uppercase tracking-widest mb-4">Quick Links</h4>
            <ul className="space-y-2 text-xs">
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
