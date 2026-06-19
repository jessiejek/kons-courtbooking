import React, { useRef, useState } from 'react';
import { Check, ClipboardList, PlusCircle, Download, MapPin } from 'lucide-react';
import { Booking } from '../types';
import BookingReceiptPDF from './BookingReceiptPDF';

interface ConfirmedPageProps {
  onNavigate: (screen: 'landing' | 'booking' | 'checkout' | 'confirmed' | 'bookings-list' | 'booking-detail') => void;
  booking: Booking | null;
  onOpenLogin: () => void;
  role: 'user' | 'admin' | null;
  onLogout: () => void;
  currentUser?: { name: string; email: string; avatar?: string; } | null;
}

export default function ConfirmedPage({ onNavigate, booking, onOpenLogin, role, onLogout, currentUser }: ConfirmedPageProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const details = booking || {
    id: 'SPC-88219',
    courtId: 'court-1',
    courtName: 'Court 1 (Premium Indoor)',
    date: '2026-10-13',
    startTime: '09:00',
    endTime: '11:00',
    slots: ['09:00', '10:00'],
    price: 600,
    status: 'Upcoming' as const,
    fullName: 'Juan Dela Cruz',
    phoneNumber: '+63 912 345 6789',
    paymentMethod: 'Card' as const,
    cardEnding: '4242',
    createdAt: new Date().toISOString(),
  };

  const getReadableSelectedDate = () => {
    const d = new Date(details.date);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getFormattedTimeLabel = (t: string) => {
    const [h, m] = t.split(':');
    const hourVal = parseInt(h);
    const suffix = hourVal >= 12 ? 'PM' : 'AM';
    const displayH = hourVal % 12 === 0 ? 12 : hourVal % 12;
    return `${displayH}:${m} ${suffix}`;
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current || isGenerating) return;
    setIsGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 600,
        windowWidth: 600,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [600, canvas.height / 2] });
      pdf.addImage(imgData, 'PNG', 0, 0, 600, canvas.height / 2);
      pdf.save(`Booking-${details.id}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans flex flex-col">
      {/* Hidden receipt for PDF capture */}
      <BookingReceiptPDF booking={details as Booking} divRef={receiptRef} />

      <header className="bg-slate-900 text-white py-4 px-6 border-b border-slate-800 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('landing')}>
          <div className="w-7 h-7 rounded-lg bg-[#00694c] flex items-center justify-center">
            <span className="font-black text-white text-sm">S</span>
          </div>
          <span className="font-sans font-black uppercase text-sm tracking-tight">Sunshine Pickleball</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
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
            <button onClick={onOpenLogin} className="text-slate-300 hover:text-white transition-colors py-1 px-3 border border-slate-600 hover:border-slate-400 rounded">Log in</button>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="max-w-xl w-full text-center space-y-6">

          {/* Success badge */}
          <div className="relative mx-auto w-20 h-20 bg-[#00694c] rounded-full flex items-center justify-center shadow-lg shadow-[#00694c]/20 transform hover:scale-105 transition-transform">
            <div className="absolute inset-0 rounded-full border border-[#003d2b] animate-ping opacity-15" />
            <Check className="w-10 h-10 text-white" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-sans font-black tracking-tight text-slate-900">Booking Confirmed!</h1>
            <p className="text-slate-600 text-sm max-w-sm mx-auto leading-relaxed">
              Your court is secured. A confirmation SMS summary has been transmitted to{' '}
              <span className="font-semibold text-slate-800">{details.phoneNumber}</span>.
            </p>
          </div>

          {/* Ticket stub */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden text-left relative">

            {/* Cutout notches */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between px-2.5 z-10 pointer-events-none">
              <div className="w-5 h-10 -ml-5 bg-slate-50 border-r border-slate-200 rounded-r-full" />
              <div className="w-5 h-10 -mr-5 bg-slate-50 border-l border-slate-200 rounded-l-full" />
            </div>

            {/* Upper ticket */}
            <div className="p-6 md:p-8 space-y-4 border-b border-dashed border-slate-200">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-widest leading-none">ORDER ID</span>
                  <span className="text-md font-mono font-black text-slate-800 mt-1 block">#{details.id}</span>
                </div>
                <span className="text-xs bg-[#e8f5ee] text-[#003d2b] border border-[#00694c]/30 font-mono font-black px-3 py-1 rounded-full uppercase">
                  Paid
                </span>
              </div>

              <div>
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">COURT SPECIFICATION</span>
                <h3 className="text-lg font-sans font-extrabold text-slate-900 mt-1">{details.courtName}</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">SCHEDULE DATE</span>
                  <span className="text-xs font-semibold text-slate-800 block mt-1">{getReadableSelectedDate()}</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">BLOCK TIME</span>
                  <span className="text-xs font-semibold text-[#005a40] mt-1 block bg-[#bbead4] px-2 py-0.5 rounded w-fit">
                    {getFormattedTimeLabel(details.startTime)} – {getFormattedTimeLabel(details.endTime)}
                  </span>
                </div>
              </div>
            </div>

            {/* Lower ticket */}
            <div className="p-6 md:p-8 bg-zinc-50/70 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-y-3 text-slate-600">
                <div>
                  <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider block">RESERVED FOR</span>
                  <span className="font-semibold text-slate-900 block mt-0.5">{details.fullName}</span>
                </div>
                <div>
                  <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider block">PAYMENT GATEWAY</span>
                  <span className="font-semibold text-slate-900 block mt-0.5">
                    {details.paymentMethod} {details.cardEnding && `(Ending ${details.cardEnding})`}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider block">FACILITY LOCATION</span>
                  <span className="font-semibold text-slate-950 mt-0.5 flex gap-1 items-start">
                    <MapPin className="w-3.5 h-3.5 text-slate-800 shrink-0 mt-0.5" />
                    7th Ave &amp; 30th St, Bonifacio Global City, Taguig, PH
                  </span>
                </div>
              </div>

              <hr className="border-slate-200/60" />

              <div className="flex justify-between items-center text-slate-900">
                <span className="font-bold text-slate-700">Total Transaction Price</span>
                <span className="text-2xl font-black font-mono leading-none">₱{details.price}.00</span>
              </div>

              {/* Staff note */}
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-center space-y-0.5">
                <p className="font-mono text-[9px] text-slate-400 uppercase tracking-widest">Staff Verification</p>
                <p className="font-bold text-slate-800 text-xs">Present this receipt at the front desk for gate entry.</p>
                <p className="font-mono text-[10px] text-slate-500">Sunshine Pickleball Courts · BGC, Taguig</p>
              </div>

              {/* Download button */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isGenerating}
                className="w-full py-3 bg-[#00694c] hover:bg-[#005a40] disabled:opacity-60 text-white font-mono text-xs font-bold uppercase rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#00694c]/20"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Booking Receipt (PDF)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => onNavigate('bookings-list')}
              className="flex-1 py-4 bg-slate-900 text-white hover:bg-slate-800 font-mono text-xs font-bold uppercase rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" /> View My Bookings
            </button>
            <button
              onClick={() => onNavigate('booking')}
              className="flex-1 py-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs font-bold uppercase rounded-xl active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Book Another Court
            </button>
          </div>

          <p className="text-[10px] font-mono text-slate-400 leading-normal max-w-sm mx-auto">
            Save the PDF to your phone — show it at the front desk for gate entry.
          </p>

        </div>
      </div>
    </div>
  );
}
