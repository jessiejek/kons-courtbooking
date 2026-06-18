import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { Screen, Booking, Court } from './types';
import { COURTS, INITIAL_BOOKINGS } from './data';
import LandingPage from './components/LandingPage';
import BookingSelector from './components/BookingSelector';
import CheckoutPage from './components/CheckoutPage';
import ConfirmedPage from './components/ConfirmedPage';
import BookingsHistory from './components/BookingsHistory';
import BookingDetailPage from './components/BookingDetailPage';
import TechnologyModal from './components/TechnologyModal';
import LoginModal from '../LoginModal';

interface Props {
  role: 'user' | 'admin' | null;
  onLogin: (role: 'user' | 'admin') => void;
  onLogout: () => void;
}

const SCREEN_TO_PATH: Record<Screen, string> = {
  'landing':        '/',
  'booking':        '/booking',
  'checkout':       '/checkout',
  'confirmed':      '/confirmed',
  'bookings-list':  '/bookings',
  'booking-detail': '/bookings', // navigating to detail goes via handleViewDetail
};

export default function CustomerApp({ role, onLogin, onLogout }: Props) {
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState('2026-10-13');
  const [selectedCourtId, setSelectedCourtId] = useState('court-1');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [cartTimeLeft, setCartTimeLeft] = useState<number>(600);
  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem('sunshine_pick_bookings');
    if (saved) {
      try { return JSON.parse(saved); } catch { return INITIAL_BOOKINGS; }
    }
    return INITIAL_BOOKINGS;
  });
  const [lastCommittedBooking, setLastCommittedBooking] = useState<Booking | null>(null);
  const [techModalOpen, setTechModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sunshine_pick_bookings', JSON.stringify(bookings));
  }, [bookings]);

  const handleCompleteBooking = (newBooking: Booking) => {
    setBookings((prev) => [newBooking, ...prev]);
    setLastCommittedBooking(newBooking);
    setSelectedSlots([]);
    setCartTimeLeft(600);
  };

  const handleCancelBooking = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'Cancelled' as const } : b))
    );
  };

  const getActiveCourtDetails = (): Court =>
    COURTS.find((c) => c.id === selectedCourtId) || COURTS[0];

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
          />
        } />

        <Route path="/checkout" element={
          <CheckoutPage
            {...sharedNav}
            selectedCourt={getActiveCourtDetails()}
            selectedDate={selectedDate}
            selectedSlots={selectedSlots}
            cartTimeLeft={cartTimeLeft}
            onCompleteBooking={handleCompleteBooking}
          />
        } />

        <Route path="/confirmed" element={
          <ConfirmedPage {...sharedNav} booking={lastCommittedBooking} />
        } />

        <Route path="/bookings" element={
          <BookingsHistory
            {...sharedNav}
            bookings={bookings}
            onViewDetail={handleViewDetail}
          />
        } />

        <Route path="/bookings/:id" element={
          <BookingDetailPage
            {...sharedNav}
            bookings={bookings}
            onCancelBooking={handleCancelBooking}
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
        }}
      />
    </div>
  );
}
