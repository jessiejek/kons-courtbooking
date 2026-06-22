import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { Screen, Booking, Court } from './types';
import { COURTS } from './data';
import LandingPage from './components/LandingPage';
import BookingSelector from './components/BookingSelector';
import CheckoutPage from './components/CheckoutPage';
import ConfirmedPage from './components/ConfirmedPage';
import BookingsHistory from './components/BookingsHistory';
import BookingDetailPage from './components/BookingDetailPage';
import TechnologyModal from './components/TechnologyModal';
import OpenPlayLive from './components/OpenPlayLive';
import OpenPlayRegister from './components/OpenPlayRegister';
import TournamentLive from './components/TournamentLive';
import LoginModal from '../LoginModal';
import { CurrentUser } from '../App';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

interface Props {
  role: 'user' | 'admin' | null;
  onLogin: (role: 'user' | 'admin') => void;
  onLogout: () => void;
  currentUser: CurrentUser | null;
}

const SCREEN_TO_PATH: Record<Screen, string> = {
  'landing':        '/',
  'booking':        '/booking',
  'checkout':       '/checkout',
  'confirmed':      '/confirmed',
  'bookings-list':  '/bookings',
  'booking-detail': '/bookings',
};

export default function CustomerApp({ role, onLogin, onLogout, currentUser }: Props) {
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [selectedCourtId, setSelectedCourtId] = useState('court-1');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [cartTimeLeft, setCartTimeLeft] = useState<number>(600);
  const [lastCommittedBooking, setLastCommittedBooking] = useState<Booking | null>(null);
  const [techModalOpen, setTechModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [finalPrice, setFinalPrice] = useState(0);
  const [courtDbId, setCourtDbId] = useState<number | null>(null);
  const holdSessionId = useRef(crypto.randomUUID()).current;
  // Live courts from Supabase — keyed by slug
  const [liveCourts, setLiveCourts] = useState<Record<string, { name: string; type: string; dbId: number; pricePerHour: number }>>({});

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    supabase.from('courts').select('id, slug, name, surface_type, default_price').eq('status', 'active').then(({ data }) => {
      if (!data) return;
      const map: typeof liveCourts = {};
      data.forEach((c: any) => {
        map[c.slug] = { name: c.name, type: c.surface_type === 'indoor' ? 'Indoor' : 'Outdoor', dbId: c.id, pricePerHour: Number(c.default_price) };
      });
      setLiveCourts(map);
    });
  }, []);

  const handleCompleteBooking = (newBooking: Booking) => {
    setLastCommittedBooking(newBooking);
    setSelectedSlots([]);
    setCartTimeLeft(600);
  };

  const getActiveCourtDetails = (): Court => {
    const static_ = COURTS.find((c) => c.id === selectedCourtId) || COURTS[0];
    const live = liveCourts[selectedCourtId];
    if (!live) return static_;
    return { ...static_, name: live.name, type: live.type as Court['type'], pricePerHour: live.pricePerHour };
  };

  const handleNavigate = (targetScreen: Screen) => {
    navigate(SCREEN_TO_PATH[targetScreen]);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleViewDetail = (id: string) => {
    navigate(`/bookings/${id}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const sharedNav = {
    onNavigate: handleNavigate,
    onOpenLogin: () => setLoginModalOpen(true),
    role,
    onLogout,
    currentUser,
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500/20 selection:text-blue-900">
      <Routes>
        <Route path="/" element={
          <LandingPage {...sharedNav} onOpenTechModal={() => setTechModalOpen(true)} />
        } />

        <Route path="/booking" element={
          <BookingSelector
            {...sharedNav}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedCourtId={selectedCourtId}
            setSelectedCourtId={setSelectedCourtId}
            selectedSlots={selectedSlots}
            setSelectedSlots={setSelectedSlots}
            cartTimeLeft={cartTimeLeft}
            setCartTimeLeft={setCartTimeLeft}
            onFinalPriceChange={setFinalPrice}
            onCourtDbIdChange={setCourtDbId}
          />
        } />

        <Route path="/checkout" element={
          <CheckoutPage
            {...sharedNav}
            selectedCourt={getActiveCourtDetails()}
            selectedDate={selectedDate}
            selectedSlots={selectedSlots}
            cartTimeLeft={cartTimeLeft}
            setCartTimeLeft={setCartTimeLeft}
            onCompleteBooking={handleCompleteBooking}
            finalPrice={finalPrice}
            courtDbId={courtDbId}
            holdSessionId={holdSessionId}
          />
        } />

        <Route path="/confirmed" element={
          <ConfirmedPage {...sharedNav} booking={lastCommittedBooking} />
        } />

        <Route path="/bookings" element={
          <BookingsHistory
            {...sharedNav}
            bookings={[]}
            onViewDetail={handleViewDetail}
          />
        } />

        <Route path="/bookings/:id" element={
          <BookingDetailPage
            {...sharedNav}
            onCancelBooking={() => {}}
          />
        } />

        <Route path="/open-play/live" element={<OpenPlayLive />} />
        <Route path="/tournament/:id" element={<TournamentLive />} />
        <Route path="/open-play/register" element={
          <OpenPlayRegister
            currentUser={currentUser}
            onOpenLogin={() => setLoginModalOpen(true)}
          />
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <TechnologyModal isOpen={techModalOpen} onClose={() => setTechModalOpen(false)} />

      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLogin={(r) => {
          onLogin(r);
          if (r === 'admin') navigate('/admin');
          else {
            // If user was trying to register for open play, redirect back
            const pending = window.location.pathname + window.location.search;
            if (!pending.startsWith('/open-play/register')) {
              const returnTo = sessionStorage.getItem('open_play_return');
              if (returnTo) { sessionStorage.removeItem('open_play_return'); navigate(returnTo); }
            }
          }
        }}
      />
    </div>
  );
}
