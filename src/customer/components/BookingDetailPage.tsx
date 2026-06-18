import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, Trash2, Download, ShieldAlert, Phone, MapPin, Printer, ExternalLink, HelpCircle, X, ShieldCheck } from 'lucide-react';
import { Booking } from '../types';
import { COURTS } from '../data';
import { useRealtimeBookings } from '../../hooks/useRealtimeBookings';

interface BookingDetailPageProps {
  onNavigate: (screen: 'landing' | 'booking' | 'checkout' | 'confirmed' | 'bookings-list' | 'booking-detail') => void;
  bookings: Booking[];
  onCancelBooking: (id: string) => void;
  onOpenLogin: () => void;
  role: 'user' | 'admin' | null;
  onLogout: () => void;
  currentUser?: { name: string; email: string; avatar?: string; } | null;
}

export default function BookingDetailPage({
  onNavigate,
  bookings,
  onCancelBooking,
  onOpenLogin,
  role,
  currentUser,
  onLogout,
}: BookingDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [phoneDialed, setPhoneDialed] = useState(false);
  const [liveStatus, setLiveStatus] = useState<Booking['status'] | null>(null);

  const booking = bookings.find((b) => b.id === id);

  // Subscribe to status changes for this specific booking
  useRealtimeBookings({
    mode: 'mine',
    bookingRef: booking?.id,
    onUpdate: (row) => {
      // Map Supabase booking_status → customer app status
      const map: Record<string, Booking['status']> = {
        confirmed: 'Upcoming',
        paid: 'Upcoming',
        completed: 'Past',
        cancelled: 'Cancelled',
      };
      const mapped = map[row.booking_status];
      if (mapped) setLiveStatus(mapped);
    },
  });

  // Use live status if available, otherwise fall back to prop
  const effectiveBooking = booking && liveStatus
    ? { ...booking, status: liveStatus }
    : booking;

  if (!booking) {
    return (
      <div className="bg-slate-50 min-h-screen font-sans flex flex-col items-center justify-center p-6 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-[#BA1A1A] mx-auto animate-bounce" />
        <h3 className="font-sans font-bold text-slate-800 text-lg">Booking Reservation Not Found</h3>
        <p className="text-xs text-slate-500 max-w-sm leading-normal">
          This receipt ID could not be matched. Returning to dashboard accounts page.
        </p>
        <button
          onClick={() => onNavigate('bookings-list')}
          className="px-5 py-2.5 bg-blue-600 text-white font-mono text-xs font-bold uppercase rounded-lg hover:bg-blue-700"
        >
          View Dashboard
        </button>
      </div>
    );
  }

  const getReadableSelectedDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getFormattedTimeLabel = (t: string) => {
    const [h, m] = t.split(':');
    const hourVal = parseInt(h);
    const suffix = hourVal >= 12 ? 'PM' : 'AM';
    const displayH = hourVal % 12 === 0 ? 12 : hourVal % 12;
    return `${displayH}:${m} ${suffix}`;
  };

  const getCourtDetails = () => {
    return COURTS.find((c) => c.id === booking.courtId) || COURTS[0];
  };

  const activeCourt = getCourtDetails();

  const handleConfirmCancel = () => {
    onCancelBooking(booking.id);
    setShowCancelModal(false);
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans flex flex-col">
      {/* Header Bar */}
      <header className="bg-slate-900 text-white py-4 px-6 border-b border-slate-800 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => onNavigate('bookings-list')}
          className="flex items-center gap-3 bg-transparent border-none cursor-pointer text-left"
        >
          <ChevronLeft className="w-5 h-5 text-slate-400 hover:text-white" />
          <div>
            <span className="font-sans font-black uppercase text-sm tracking-tight block">Sunshine pickleball</span>
            <span className="font-mono text-[8px] uppercase tracking-widest text-blue-400 block font-semibold">User Bookings</span>
          </div>
        </button>
        
        <div className="flex items-center gap-3 text-xs font-mono">
          {role ? (
            <div className="flex items-center gap-2">
              {currentUser?.avatar
                ? <img src={currentUser.avatar} referrerPolicy="no-referrer" className="w-7 h-7 rounded-full border border-slate-600 object-cover" />
                : <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold">{currentUser?.name?.[0]?.toUpperCase() ?? 'U'}</div>
              }
              <span className="text-slate-300 text-xs hidden md:block max-w-[120px] truncate">{currentUser?.name}</span>
              <button onClick={onLogout} className="text-slate-400 hover:text-white py-1 px-2 bg-zinc-800/80 rounded text-xs">Sign out</button>
            </div>
          ) : (
            <button onClick={onOpenLogin} className="text-slate-300 hover:text-white transition-colors py-1 px-3 border border-slate-600 hover:border-slate-400 rounded">Log in</button>
          )}
          <button
            onClick={() => onNavigate('booking')}
            className="text-white uppercase bg-blue-600 hover:bg-blue-700 font-bold py-1.5 px-4 rounded transition-all cursor-pointer"
          >
            New Reservation
          </button>
        </div>
      </header>

      {/* Main Details Panel Layout split block */}
      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1">
        
        {/* Left Panel: Booking Specific info */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-sm space-y-6">
            
            {/* Upper Badge & ID info */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">TRANSACTION RECEIPT</span>
                <h2 className="text-xl font-sans font-black text-[#05140B] mt-1">
                  Booking #{booking.id}
                </h2>
                <p className="text-[10px] font-mono text-slate-400 mt-1">Created on October 10, 2026 at 02:30 PM (PST)</p>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                {effectiveBooking?.status === 'Upcoming' && (
                  <span className="text-xs bg-blue-50 text-blue-800 border border-blue-200 font-mono font-black uppercase px-3 py-1.5 rounded-full block text-center min-w-[100px]">
                    ● Scheduled
                  </span>
                )}
                {effectiveBooking?.status === 'Past' && (
                  <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 font-mono font-bold uppercase px-3 py-1.5 rounded-full block text-center min-w-[100px]">
                    Past Session
                  </span>
                )}
                {effectiveBooking?.status === 'Cancelled' && (
                  <span className="text-xs bg-[#BA1A1A]/10 text-[#BA1A1A] border border-[#BA1A1A]/20 font-mono font-bold uppercase px-3 py-1.5 rounded-full block text-center min-w-[100px]">
                    Cancelled
                  </span>
                )}
                {liveStatus && (
                  <span className="text-[9px] font-mono text-emerald-600 flex items-center gap-1 opacity-80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    Live
                  </span>
                )}
              </div>
            </div>

            {/* Structured Table Info block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-4">
                {/* Section A: Facility */}
                <div>
                  <span className="font-mono text-[10px] uppercase text-slate-400 tracking-wider">RESERVED CLUB</span>
                  <p className="font-extrabold text-[#05140B] mt-1">Sunshine Pickleball Club</p>
                  <p className="text-xs text-slate-500 mt-0.5">Bonifacio Global City, Taguig City, PH</p>
                </div>

                {/* Section B: Playing schedule */}
                <div>
                  <span className="font-mono text-[10px] uppercase text-slate-400 tracking-wider">SESSION TIMELINE</span>
                  <p className="font-bold text-slate-800 mt-1">{getReadableSelectedDate(booking.date)}</p>
                  <p className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded w-fit mt-1 block">
                    {getFormattedTimeLabel(booking.startTime)} - {getFormattedTimeLabel(booking.endTime)} (2-Hour session)
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Section C: Assigned court */}
                <div>
                  <span className="font-mono text-[10px] uppercase text-slate-400 tracking-wider">ASSIGNED COURT</span>
                  <p className="font-extrabold text-[#05140B] mt-1">{booking.courtName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{activeCourt.type} cushions layout</p>
                </div>

                {/* Section D: Customer credentials */}
                <div>
                  <span className="font-mono text-[10px] uppercase text-slate-400 tracking-wider">CHIEF BOOKER GUEST</span>
                  <p className="font-bold text-slate-800 mt-1">{booking.fullName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{booking.phoneNumber}</p>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Invoicing Breakdown section */}
            <div className="space-y-3">
              <h3 className="font-sans font-extrabold text-sm text-[#05140B] uppercase tracking-wider">
                Financial Transaction Audit
              </h3>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Court Fee Base Price</span>
                  <span className="font-mono text-slate-800 font-semibold">₱600.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Carbon Racquets & Gear rental</span>
                  <span className="font-mono text-emerald-600 font-bold uppercase">Free Allowance</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing Gateway surcharges</span>
                  <span className="font-mono text-slate-800">₱{booking.paymentMethod === 'Card' ? '25.00' : '0.00'}</span>
                </div>

                <div className="flex justify-between text-slate-900 border-t border-slate-200/60 pt-2.5 text-sm font-bold">
                  <span>Amount Paid via {booking.paymentMethod}</span>
                  <span className="font-mono text-slate-900">₱{booking.price}.00</span>
                </div>
              </div>
            </div>

            {/* Action controls footer card */}
            <hr className="border-slate-100" />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowReceiptModal(true)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-[#05140B] font-mono text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all outline-none border-none cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download e-Receipt
              </button>

              {effectiveBooking?.status === 'Upcoming' && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="flex-1 py-3 bg-[#BA1A1A]/10 hover:bg-[#BA1A1A]/20 text-[#BA1A1A] font-mono text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all outline-none border-none cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Cancel Booking
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Right Panel: Protocol rules & Access directives */}
        <div className="lg:col-span-4 space-y-6">
          {/* Photos widget */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDflRyAyRElrM8rqUnguE6w5PmIDC5BNVKVe0bK2Tvyur65W3kDqeD9BZ37gMDGwOQX7h_lBKS_nX-dCcP₱6y9bH1G_4ZKqC3E6EoMnG₱2uNZoOHIZ2tkLOd2ATN5Yr4PYQgEi2Kz27JdX571WJW8cicJV0XSV2YkN8djGsENzAwgU2En1WJYx_XW-fuxi3fIgq7eYLjcHnc395c1h8OmQ4xcv5vBh16-2rQJig0A5-uztkWoj8S7Jncfa2geNNzclHKVDu3I6t4pq0"
              alt="Assigned court map area"
              className="w-full h-48 object-cover filter contrast-110 shrink"
              referrerPolicy="no-referrer"
            />
            
            <div className="p-5 space-y-4">
              <h3 className="font-sans font-black text-slate-900 uppercase tracking-tight text-sm">
                Club Rules & Protocol
              </h3>

              <div className="space-y-3.5 text-xs text-slate-500 leading-normal">
                <p className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#05140B] shrink-0 text-[10px]">1</span>
                  <span>Please arrive at least <strong>10 minutes before</strong> your playing schedule to register variables.</span>
                </p>
                <p className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#05140B] shrink-0 text-[10px]">2</span>
                  <span>Proper <strong>non-marking athletic tennis shoes</strong> are strictly required on all court floor systems.</span>
                </p>
                <p className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#05140B] shrink-0 text-[10px]">3</span>
                  <span>Professional grade carbon fiber paddles are rented for free (on the house!) for your whole group!</span>
                </p>
              </div>

              <hr className="border-slate-100" />

              {/* Direct interactive help widgets */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowMapModal(true)}
                  className="p-3 bg-slate-900 text-white hover:bg-slate-800 font-mono text-[10px] uppercase font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all outline-none border-none cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-400" /> Get Directions
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPhoneDialed(true);
                    setTimeout(() => setPhoneDialed(false), 2500);
                  }}
                  className="p-3 bg-white border border-slate-200 hover:border-slate-800 text-slate-800 font-mono text-[10px] uppercase font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-500" /> {phoneDialed ? 'DIALING...' : 'Call Front Desk'}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL 1: Cancellation Warnings (interactive) */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl relative">
            <h3 className="font-sans font-black text-white text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#BA1A1A]" /> Cancel Court Playing?
            </h3>
            <p className="text-xs text-slate-450 leading-relaxed">
              Are you sure you want to cancel booking <strong>#{booking.id}</strong>? Cancellation complies with our 24h bylaws. A coupon load credit of <strong>₱{booking.price}</strong> will be loaded automatically to your profile phone wallet.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 border border-slate-700 hover:border-white text-slate-400 hover:text-white font-mono text-xs uppercase font-semibold rounded-lg cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 bg-[#BA1A1A] hover:bg-[#a11414] text-white font-mono text-xs uppercase font-bold rounded-lg cursor-pointer"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Receipt invoice (Download/Print representation) */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl relative border border-slate-300">
            <button
              onClick={() => setShowReceiptModal(false)}
              className="absolute top-4 right-4 p-1 px-2 text-slate-450 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-6 h-6 border-none" />
            </button>

            {/* Receipt invoice branding */}
            <div className="text-center space-y-2 border-b border-slate-100 pb-5">
              <div className="flex items-center justify-center gap-2">
                <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center border border-blue-500/20">
                  <span className="font-mono text-white font-extrabold text-sm">S</span>
                </div>
                <span className="font-sans font-black text-slate-900 uppercase tracking-tight text-sm">Sunshine Pickleball Club</span>
              </div>
              <h2 className="text-xl font-bold font-sans">Payment Invoice Receipt</h2>
              <p className="text-[10px] font-mono text-slate-400">Order ID: #{booking.id} | Billed via {booking.paymentMethod} Gateway</p>
            </div>

            {/* Invoice Structured Content */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider block">Billed To:</span>
                <p className="font-bold text-slate-800 mt-1">{booking.fullName}</p>
                <p className="text-slate-500 mt-0.5">{booking.phoneNumber}</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider block">Billed From:</span>
                <p className="font-bold text-slate-800 mt-1">Sunshine Club Inc.</p>
                <p className="text-slate-500 mt-0.5">7th Ave, Bonifacio Global City, Taguig, PH</p>
              </div>
            </div>

            {/* Invoiced Table Items */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-slate-100 p-2.5 font-bold text-slate-700 grid grid-cols-4">
                <span className="col-span-2">Item Description</span>
                <span className="text-center">Hours</span>
                <span className="text-right">Price</span>
              </div>
              
              <div className="p-3 grid grid-cols-4 border-b border-slate-100 text-slate-600">
                <span className="col-span-2 font-semibold text-slate-800">{booking.courtName} - reservation date {booking.date}</span>
                <span className="text-center font-mono">2</span>
                <span className="text-right font-mono">₱550.00</span>
              </div>

              <div className="p-3 grid grid-cols-4 border-b border-slate-100 text-[#0063E5] bg-[#E8F1FC]/30">
                <span className="col-span-2 font-semibold">Premium Carbon Paddle Rentals Pack x4</span>
                <span className="text-center font-mono">Included</span>
                <span className="text-right font-mono uppercase font-black text-emerald-600">Free</span>
              </div>

              {booking.paymentMethod === 'Card' && (
                <div className="p-3 grid grid-cols-4 text-slate-500">
                  <span className="col-span-2">Merchant Processing Gateway Surcharge</span>
                  <span className="text-center italic">—</span>
                  <span className="text-right font-mono">₱25.00</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-slate-900 border-t border-slate-100 pt-4 text-sm font-bold">
              <span>Grand Total Paid</span>
              <span className="text-xl font-mono">₱{booking.price}.00</span>
            </div>

            {/* Interactive Print buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-950 text-white font-mono text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all outline-none border-none cursor-pointer"
              >
                <Printer className="w-4 h-4 text-blue-300" /> Trigger Browser Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Simulator direction maps */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 border border-slate-200 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowMapModal(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-850 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 border-none" />
            </button>

            <h3 className="font-sans font-black text-slate-900 text-base uppercase tracking-tight flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" /> Simulated Geolocation Map
            </h3>

            {/* Mini Map grid mock visual */}
            <div className="bg-slate-100 rounded-xl border border-slate-200 h-64 overflow-hidden relative flex items-center justify-center text-center p-6 text-slate-600">
              {/* Fake road systems overlay patterns */}
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#1e293b 2px, transparent 2px)', backgroundSize: '24px 24px' }} />
              
              <div className="relative space-y-3 shrink z-10">
                <div className="w-10 h-10 bg-blue-600 rounded-full border border-blue-800 shadow-md flex items-center justify-center mx-auto text-white">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-slate-200/80 max-w-sm">
                  <p className="font-bold text-xs text-slate-800">Sunshine Pickleball Club</p>
                  <p className="text-[10px] text-slate-600 mt-1">7th Avenue corner 30th Street, Bonifacio Global City, Taguig City, Philippines</p>
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-500 leading-normal bg-slate-50 p-3 rounded-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" /> Free parking validation occurs automatically post-play at court reservation terminal.
            </div>

            <button
              onClick={() => setShowMapModal(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#05140B] font-mono text-xs uppercase font-bold rounded-lg cursor-pointer"
            >
              Dismiss Map
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
