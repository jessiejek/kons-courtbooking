import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Calendar, User, Phone, X, Sparkles } from 'lucide-react';
import LoginModal from '../LoginModal';
import { Court, Booking, DayOfWeek, TimePriceRange, BookingStatus } from './types';
import { defaultCourts } from './data';
import { useRealtimeBookings } from '../hooks/useRealtimeBookings';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import BookingsView from './components/BookingsView';
import CourtsPricingView from './components/CourtsPricingView';
import AddEditCourtView from './components/AddEditCourtView';
import { useToast, ToastContainer } from '../components/Toast';
import ConfirmModal, { ConfirmOptions } from '../components/ConfirmModal';

interface Props {
  role: 'user' | 'admin' | null;
  onLogin: (role: 'user' | 'admin') => void;
  onLogout: () => void;
  currentUser?: { name: string; email: string; avatar?: string; } | null;
}

function CourtEditRoute({
  courts,
  onSaveCourt,
  onDeleteCourt,
}: {
  courts: Court[];
  onSaveCourt: (court: Court) => void;
  onDeleteCourt: (id: number) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editCourtId = id === 'new' ? 'new' : Number(id);
  return (
    <AddEditCourtView
      editCourtId={editCourtId}
      courts={courts}
      onSaveCourt={onSaveCourt}
      onDeleteCourt={onDeleteCourt}
      onCancel={() => navigate('/admin/courts')}
    />
  );
}

function LocationsView() {
  return (
    <div className="bg-white border rounded-xl p-8 max-w-2xl mx-auto text-center space-y-4 shadow-sm">
      <div className="p-3 bg-secondary-container/50 w-fit mx-auto rounded-full">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-2xl font-bold font-headline text-on-surface">Club Facility Locations</h2>
      <p className="text-sm text-on-surface-variant leading-relaxed max-w-md mx-auto">
        Sunshine Pickleball Courts operates 3 premium locations across Metro Manila.
        Configure pricing scales and reservation options straight from this terminal.
      </p>
      <div className="border border-outline-variant/60 rounded-lg divide-y divide-outline-variant/30 text-sm mt-6 text-left font-medium">
        <div className="p-4 flex justify-between bg-surface-container-low/10">
          <span>1. Sunshine Hills Country Club</span>
          <span className="text-primary font-bold">Main Office</span>
        </div>
        <div className="p-4 flex justify-between">
          <span>2. West Makati Clay Courts</span>
          <span className="text-on-surface-variant">2 Indoor</span>
        </div>
        <div className="p-4 flex justify-between overflow-hidden">
          <span>3. East High Hardwood Courts</span>
          <span className="text-on-surface-variant">1 Outdoor</span>
        </div>
      </div>
    </div>
  );
}

const mapRow = (row: any): Booking => ({
  id: row.id,
  bookingId: row.booking_ref,
  date: row.booking_date,
  time: row.start_time?.slice(0, 5) ?? '',
  courtId: row.court_id ?? 1,
  courtName: row.court_name ?? '',
  customerName: row.customer_name ?? '',
  phone: row.customer_phone ?? '',
  status: row.booking_status,
  amount: Number(row.total_amount ?? 0),
});

export default function AdminApp({ role, onLogin, onLogout, currentUser }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { toasts, toast, removeToast } = useToast();
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [nbCustomer, setNbCustomer] = useState('');
  const [nbPhone, setNbPhone] = useState('');
  const [nbDate, setNbDate] = useState('');
  const [nbTime, setNbTime] = useState('09:00');
  const [nbCourtId, setNbCourtId] = useState<number>(1);
  const [nbStatus, setNbStatus] = useState<BookingStatus>('pending');
  const [nbAmount, setNbAmount] = useState(1200);

  useEffect(() => {
    loadCourts();
    loadBookings();
  }, []);

  const loadCourts = async () => {
    if (!isSupabaseEnabled || !supabase) { setCourts(defaultCourts); return; }
    const { data, error } = await supabase
      .from('courts')
      .select('*')
      .order('id', { ascending: true });
    if (error || !data || data.length === 0) { setCourts(defaultCourts); return; }
    setCourts(data.map((row: any) => ({
      id: row.id,
      name: row.name,
      surfaceType: row.surface_type ?? 'indoor',
      opensAt: row.opens_at ?? '06:00',
      closesAt: row.closes_at ?? '22:00',
      defaultPrice: Number(row.default_price ?? 300),
      status: row.status ?? 'active',
      pricing: {},
    })));
  };

  const loadBookings = async () => {
    if (!isSupabaseEnabled || !supabase) return;
    setLoadingBookings(true);
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });
    setLoadingBookings(false);
    if (error) { console.error('[Supabase] load bookings error:', error); return; }
    setBookings((data ?? []).map(mapRow));
  };

  const handleSaveCourt = async (court: Court) => {
    const row = {
      name: court.name,
      surface_type: court.surfaceType,
      opens_at: court.opensAt,
      closes_at: court.closesAt,
      default_price: court.defaultPrice,
      status: court.status,
    };
    if (!isSupabaseEnabled || !supabase) { setCourts(prev => prev.some(c => c.id === court.id) ? prev.map(c => c.id === court.id ? court : c) : [...prev, court]); return; }
    const exists = courts.some(c => c.id === court.id);
    let error;
    if (exists) {
      ({ error } = await supabase.from('courts').update(row).eq('id', court.id));
    } else {
      ({ error } = await supabase.from('courts').insert(row));
    }
    if (error) {
      toast('error', 'Save failed', error.message);
      return;
    }
    await loadCourts();
  };

  const handleDeleteCourt = async (courtId: number) => {
    if (!isSupabaseEnabled || !supabase) { setCourts(prev => prev.filter(c => c.id !== courtId)); return; }
    await supabase.from('courts').update({ status: 'inactive' }).eq('id', courtId);
    await loadCourts();
  };

  const handleUpdateCourtPricing = (courtId: number, day: DayOfWeek, ranges: TimePriceRange[]) => {
    setCourts(prev => prev.map(c =>
      c.id === courtId ? { ...c, pricing: { ...c.pricing, [day]: ranges } } : c
    ));
  };

  const handleCreateBookingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nbCustomer.trim() || !nbPhone.trim()) { toast('warning', 'Missing fields', 'Please fill out all required fields.'); return; }
    if (!isSupabaseEnabled || !supabase) { toast('error', 'Not connected', 'Supabase is not connected.'); return; }

    const selectedCourt = courts.find(c => c.id === Number(nbCourtId)) || courts[0];
    const bookingRef = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    const customerName = nbCustomer;

    const { error } = await supabase.from('bookings').insert({
      booking_ref: bookingRef,
      booking_date: nbDate,
      start_time: nbTime,
      end_time: nbTime,
      court_id: selectedCourt?.id ?? null,
      court_name: selectedCourt?.name ?? 'Center Court',
      customer_name: customerName,
      customer_phone: nbPhone,
      booking_status: nbStatus,
      payment_method: 'cash',
      payment_status: nbStatus === 'paid' ? 'paid' : 'pending',
      total_amount: Number(nbAmount),
    });

    if (error) {
      console.error('[Supabase] admin booking insert error:', error);
      toast('error', 'Failed to save booking', 'Please try again.');
      return;
    }

    setNbCustomer(''); setNbPhone(''); setNbDate(''); setNbAmount(1200); setIsNewBookingOpen(false);
    await loadBookings();
    toast('success', 'Booking created', `Booking confirmed for ${customerName}.`);
  };

  const activeDetailBooking = bookings.find(b => b.bookingId === selectedBookingId);

  const handleUpdateBookingStatus = async (bookingId: string, nextStatus: BookingStatus) => {
    if (!isSupabaseEnabled || !supabase) return;
    const { error } = await supabase
      .from('bookings')
      .update({ booking_status: nextStatus })
      .eq('booking_ref', bookingId);
    if (error) { console.error('[Supabase] status update error:', error); return; }
    setBookings(prev => prev.map(b => b.bookingId === bookingId ? { ...b, status: nextStatus } : b));
  };

  const handleDeleteBooking = (bookingId: string) => {
    setConfirmOpts({
      title: 'Cancel Booking',
      message: 'This will mark the booking as cancelled. This action cannot be undone.',
      confirmLabel: 'Yes, Cancel It',
      variant: 'danger',
      onCancel: () => setConfirmOpts(null),
      onConfirm: async () => {
        setConfirmOpts(null);
        if (!isSupabaseEnabled || !supabase) return;
        const { error } = await supabase
          .from('bookings')
          .update({ booking_status: 'cancelled' })
          .eq('booking_ref', bookingId);
        if (error) { console.error('[Supabase] cancel booking error:', error); toast('error', 'Failed to cancel', 'Please try again.'); return; }
        setBookings(prev => prev.map(b => b.bookingId === bookingId ? { ...b, status: 'cancelled' } : b));
        setSelectedBookingId(null);
        toast('success', 'Booking cancelled');
      },
    });
  };

  // ── Realtime: new bookings arrive live ──────────────────
  const [newBookingCount, setNewBookingCount] = useState(0);

  useRealtimeBookings({
    mode: 'all',
    onInsert: (row) => {
      setBookings(prev => [mapRow(row), ...prev]);
      setNewBookingCount((n) => n + 1);
    },
    onUpdate: (row) => {
      setBookings(prev =>
        prev.map((b) =>
          b.bookingId === row.booking_ref
            ? { ...b, status: row.booking_status as BookingStatus }
            : b
        )
      );
    },
  });

  const isCourtEditPage = pathname.startsWith('/admin/courts/');
  const backAction = isCourtEditPage
    ? { label: 'Back to courts grid', backPath: '/admin/courts' }
    : null;

  return (
    <div id="court-and-co-root" className="min-h-screen bg-background text-on-background flex font-sans">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {confirmOpts && <ConfirmModal {...confirmOpts} />}
      <Sidebar
        onNewBookingClick={() => setIsNewBookingOpen(true)}
        newBookingCount={newBookingCount}
        onClearNewBookingCount={() => setNewBookingCount(0)}
        currentUser={currentUser}
        onLogout={() => setConfirmOpts({
          title: 'Sign Out',
          message: 'Are you sure you want to sign out of the admin panel?',
          confirmLabel: 'Sign Out',
          variant: 'warning',
          onCancel: () => setConfirmOpts(null),
          onConfirm: () => { setConfirmOpts(null); onLogout(); },
        })}
      />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header searchText={searchText} onSearchChange={setSearchText} backAction={backAction} />

        <main className="p-10 max-w-7xl w-full mx-auto flex-1 pb-24">
          {loadingBookings && (
            <div className="text-center py-4 text-sm text-on-surface-variant font-medium animate-pulse">
              Loading bookings from Supabase…
            </div>
          )}
          <Routes>
            <Route path="/" element={
              <DashboardView
                bookings={bookings}
                courts={courts}
                onNavigateToTab={(tab) => navigate(`/admin/${tab === 'dashboard' ? '' : tab}`)}
                onOpenBookingDetails={setSelectedBookingId}
              />
            } />

            <Route path="/bookings" element={
              <BookingsView
                bookings={bookings}
                courts={courts}
                onOpenBookingDetails={setSelectedBookingId}
                onAddNewBooking={() => setIsNewBookingOpen(true)}
                onRefresh={loadBookings}
              />
            } />

            <Route path="/courts" element={
              <CourtsPricingView
                courts={courts}
                onEditCourtDetails={(id) => navigate(`/admin/courts/${id}`)}
                onAddNewCourt={() => navigate('/admin/courts/new')}
                onUpdateCourtPricing={handleUpdateCourtPricing}
              />
            } />

            <Route path="/courts/:id" element={
              <CourtEditRoute
                courts={courts}
                onSaveCourt={handleSaveCourt}
                onDeleteCourt={handleDeleteCourt}
              />
            } />

            <Route path="/locations" element={<LocationsView />} />

            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>

        <footer className="mt-auto px-10 py-5 border-t border-outline-variant flex justify-between items-center bg-surface-container-low/30 text-xs">
          <p className="text-outline font-semibold">&copy; 2026 Court &amp; Co. Admin Terminal. All rights reserved.</p>
          <div className="flex gap-4">
            <button onClick={() => navigate('/')} className="text-outline font-semibold hover:text-primary transition-colors">
              ← Customer Site
            </button>
            {role ? (
              <button onClick={() => { onLogout(); navigate('/'); }} className="text-outline font-semibold hover:text-red-600 transition-colors">
                Log out
              </button>
            ) : (
              <button onClick={() => setLoginModalOpen(true)} className="text-outline font-semibold hover:text-primary transition-colors">
                Log in
              </button>
            )}
          </div>
        </footer>
      </div>

      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLogin={(r) => { onLogin(r); setLoginModalOpen(false); }}
      />

      {activeDetailBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fade-in p-4">
          <div className="bg-white border border-outline-variant rounded-xl max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="bg-surface-container px-6 py-5 border-b border-outline-variant flex justify-between items-start">
              <div>
                <span className="px-2.5 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] uppercase tracking-wider font-extrabold rounded">
                  {activeDetailBooking.bookingId}
                </span>
                <h4 className="text-lg font-bold font-headline text-on-surface mt-1.5">Reservation Detail</h4>
              </div>
              <button onClick={() => setSelectedBookingId(null)} className="p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-y-4 gap-x-2 border-b border-outline-variant/30 pb-4">
                <div>
                  <p className="text-xs text-outline uppercase tracking-wider font-semibold">Customer</p>
                  <p className="font-bold text-on-surface mt-0.5 text-base">{activeDetailBooking.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-outline uppercase tracking-wider font-semibold">Contact No.</p>
                  <p className="font-medium text-on-surface mt-0.5 font-mono">{activeDetailBooking.phone}</p>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-outline uppercase tracking-wider font-semibold">Date reserved</p>
                  <p className="font-semibold text-on-surface mt-0.5">{activeDetailBooking.date}</p>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-outline uppercase tracking-wider font-semibold">Reserved Slot</p>
                  <p className="font-semibold text-on-surface mt-0.5 font-mono">{activeDetailBooking.time}</p>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-outline uppercase tracking-wider font-semibold">Facility Court</p>
                  <p className="font-semibold text-primary mt-0.5">{activeDetailBooking.courtName}</p>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-outline uppercase tracking-wider font-semibold">Amount Paid</p>
                  <p className="font-extrabold text-on-surface mt-0.5">&#x20B1;{activeDetailBooking.amount}</p>
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Update Booking status label</p>
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {(['paid', 'confirmed', 'pending', 'cancelled', 'completed'] as BookingStatus[]).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => handleUpdateBookingStatus(activeDetailBooking.bookingId, st)}
                      className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                        activeDetailBooking.status === st
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white text-on-surface-variant border-outline-variant hover:border-outline'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-surface-container p-4 flex justify-between items-center border-t border-outline-variant/60">
              <button
                type="button"
                onClick={() => handleDeleteBooking(activeDetailBooking.bookingId)}
                className="text-red-600 hover:text-red-700 font-bold text-xs uppercase tracking-wider flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                <span>Cancel Reservation</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedBookingId(null)}
                className="bg-primary hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider px-6 py-2 rounded-lg"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewBookingOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fade-in p-4">
          <div className="bg-white border rounded-xl max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="bg-surface-container p-6 border-b border-outline-variant flex justify-between items-center">
              <div>
                <h4 className="text-lg font-bold font-headline text-on-surface flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span>Book a New Court</span>
                </h4>
                <p className="text-xs text-on-surface-variant mt-1 font-medium">Manually register a reservation on terminal.</p>
              </div>
              <button onClick={() => setIsNewBookingOpen(false)} className="p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateBookingSubmit}>
              <div className="p-6 space-y-4 text-sm">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Customer Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" required value={nbCustomer} onChange={(e) => setNbCustomer(e.target.value)} placeholder="e.g. Maria Sharapova"
                      className="w-full bg-white border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm focus:border-primary focus:ring-0 font-medium" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Contact Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="tel" required value={nbPhone} onChange={(e) => setNbPhone(e.target.value)} placeholder="e.g. 0918 200 4000"
                      className="w-full bg-white border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm focus:border-primary focus:ring-0 font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Reserve Date</label>
                    <input type="date" required value={nbDate} onChange={(e) => setNbDate(e.target.value)}
                      className="w-full bg-white border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0 font-medium" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Slot Hour</label>
                    <input type="time" required value={nbTime} onChange={(e) => setNbTime(e.target.value)}
                      className="w-full bg-white border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0 font-medium" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Court Target</label>
                    <select value={nbCourtId} onChange={(e) => setNbCourtId(Number(e.target.value))}
                      className="w-full bg-white border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0 font-medium cursor-pointer">
                      {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Rate (PHP)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-neutral-500">&#x20B1;</span>
                      <input type="number" required value={nbAmount} onChange={(e) => setNbAmount(Number(e.target.value))} placeholder="1200"
                        className="w-full bg-white border border-outline-variant rounded-lg pl-7 pr-3 p-2 text-sm focus:border-primary focus:ring-0 font-bold" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Payment Status</label>
                  <select value={nbStatus} onChange={(e) => setNbStatus(e.target.value as BookingStatus)}
                    className="w-full bg-white border border-outline-variant rounded-lg p-2 text-sm focus:border-primary focus:ring-0 font-semibold cursor-pointer uppercase tracking-wider text-xs">
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>
              </div>
              <div className="bg-surface-container p-4 flex justify-end gap-3 border-t border-outline-variant/60">
                <button type="button" onClick={() => setIsNewBookingOpen(false)}
                  className="px-5 py-2 font-bold text-xs text-on-surface-variant hover:text-on-surface uppercase tracking-wider">
                  Cancel
                </button>
                <button type="submit"
                  className="bg-primary hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider px-8 py-2 rounded-lg shadow-sm">
                  Create Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
