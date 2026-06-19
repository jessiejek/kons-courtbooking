import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Mail, Phone, User, Lock, ArrowRight, AlertTriangle, Check, Upload, X, ImageIcon } from 'lucide-react';
import { Court, Booking } from '../types';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import { notifyPaymentSubmitted } from '../../lib/notifications';

interface CheckoutPageProps {
  onNavigate: (screen: 'landing' | 'booking' | 'checkout' | 'confirmed' | 'bookings-list' | 'booking-detail') => void;
  selectedCourt: Court;
  selectedDate: string;
  selectedSlots: string[];
  cartTimeLeft: number;
  setCartTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  onCompleteBooking: (booking: Booking) => void;
  onOpenLogin: () => void;
  role: 'user' | 'admin' | null;
  onLogout: () => void;
  currentUser?: { name: string; email: string; avatar?: string; } | null;
  finalPrice?: number;
  courtDbId?: number | null;
  holdSessionId?: string;
}

export default function CheckoutPage({
  onNavigate,
  selectedCourt,
  selectedDate,
  selectedSlots,
  cartTimeLeft,
  setCartTimeLeft,
  onCompleteBooking,
  onOpenLogin,
  role,
  currentUser,
  onLogout,
  finalPrice: finalPriceProp,
  courtDbId,
  holdSessionId,
}: CheckoutPageProps) {
  // User Credentials
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isSocialLoggedIn, setIsSocialLoggedIn] = useState(false);

  // Payment proof
  const [paymentReference, setPaymentReference] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // QR image URL — replace with your actual QR image path or URL
  const QR_IMAGE_URL = '/qr.jpg';

  // Hold slots in DB for 10 mins — release on unmount or payment
  const releaseHolds = async () => {
    if (!isSupabaseEnabled || !supabase || !holdSessionId) return;
    await supabase.from('slot_holds').delete().eq('session_id', holdSessionId);
  };

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase || !holdSessionId || !courtDbId || selectedSlots.length === 0) return;
    const holdRows = selectedSlots.map(slotTime => ({
      court_id: courtDbId,
      slot_date: selectedDate,
      slot_time: slotTime,
      session_id: holdSessionId,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }));
    supabase.from('slot_holds').upsert(holdRows, { onConflict: 'session_id,court_id,slot_date,slot_time' });
    return () => { releaseHolds(); };
  }, []);

  // Keep the countdown running while on this page
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof setCartTimeLeft === 'function') {
        setCartTimeLeft((prev: number) => (prev <= 1 ? 0 : prev - 1));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Demo fallback when accessed directly with no slots (e.g. /checkout via URL bar)
  const isDemo = selectedSlots.length === 0;
  const demoSlots = ['09:00', '10:00'];
  const effectiveSlots = isDemo ? demoSlots : selectedSlots;
  const effectiveCourt = isDemo
    ? { ...selectedCourt, name: selectedCourt.name || 'Court 1 (Premium Indoor)', pricePerHour: selectedCourt.pricePerHour || 300 }
    : selectedCourt;
  const effectiveDate = isDemo ? new Date().toISOString().split('T')[0] : selectedDate;

  // Pre-fill guest details from logged-in user + saved phone from profile
  useEffect(() => {
    if (!currentUser) return;
    setFullName(currentUser.name);
    setEmail(currentUser.email);
    setIsSocialLoggedIn(true);
    // Load saved phone from profiles table
    if (isSupabaseEnabled && supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase!.from('profiles').select('phone').eq('id', user.id).single().then(({ data }) => {
          if (data?.phone) setPhoneNumber(data.phone);
        });
      });
    }
  }, [currentUser]);

  const handleSocialLogin = async (platform: 'Google' | 'Facebook') => {
    // If already logged in just fill from currentUser
    if (currentUser) {
      setFullName(currentUser.name);
      setEmail(currentUser.email);
      setIsSocialLoggedIn(true);
      return;
    }
    if (!isSupabaseEnabled || !supabase) return;
    const provider = platform === 'Google' ? 'google' : 'facebook';
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/checkout` },
    });
  };

  const handleDemoFill = () => {
    setFullName(currentUser?.name ?? 'Juan Dela Cruz');
    setPhoneNumber('+63 912 345 6789');
    setEmail(currentUser?.email ?? 'juan.delacruz@gmail.com');
    setIsSocialLoggedIn(true);
    setPaymentReference('GC-DEMO-123456');
  };

  const handleScreenshotChange = (file: File | null) => {
    setScreenshotFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setScreenshotPreview(null);
    }
  };


  // Pricing math — use live time-based price from BookingSelector if available
  const hoursCount = effectiveSlots.length;
  const courtPrice = (isDemo ? null : finalPriceProp) ?? hoursCount * effectiveCourt.pricePerHour;
  const loyaltySavings = 0; // already applied in BookingSelector finalPrice
  const totalDue = Math.max(0, courtPrice);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Convert to date read
  const getReadableSelectedDate = () => {
    const d = new Date(effectiveDate);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Generates selected intervals label
  const getSelectedTimeRangeLabel = () => {
    if (effectiveSlots.length === 0) return '';
    const sorted = [...effectiveSlots].sort();
    
    const formatTimeLabel = (t: string) => {
      const [h, m] = t.split(':');
      const hourVal = parseInt(h);
      const suffix = hourVal >= 12 ? 'PM' : 'AM';
      const displayH = hourVal % 12 === 0 ? 12 : hourVal % 12;
      return `${displayH}:${m} ${suffix}`;
    };

    const firstTime = sorted[0];
    const lastTime = sorted[sorted.length - 1];
    const [lastH, lastM] = lastTime.split(':');
    const endHVal = parseInt(lastH) + 1;
    const endTimeStr = `${endHVal.toString().padStart(2, '0')}:${lastM}`;
    
    return `${formatTimeLabel(firstTime)} - ${formatTimeLabel(endTimeStr)}`;
  };

  const isFormValid = () => {
    if (!fullName.trim()) return false;
    if (!phoneNumber.trim()) return false;
    if (!paymentReference.trim() && !screenshotFile) return false;
    return true;
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;
    setIsProcessing(true);
    setBookingError(null);

    const finalBookingId = `SPC-${Math.floor(10000 + Math.random() * 90000)}`;
    const sorted = [...effectiveSlots].sort();
    const last = sorted[sorted.length - 1];
    const [lastH, lastM] = last.split(':');
    const endTime = `${(parseInt(lastH) + 1).toString().padStart(2, '0')}:${lastM}`;

    let screenshotUrl: string | null = null;

    if (isSupabaseEnabled && supabase) {
      // Upload screenshot if provided
      if (screenshotFile) {
        const ext = screenshotFile.name.split('.').pop();
        const path = `${finalBookingId}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('payment-screenshots')
          .upload(path, screenshotFile, { upsert: true });
        if (uploadErr) {
          setIsProcessing(false);
          setBookingError('Failed to upload screenshot. Please try again.');
          return;
        }
        screenshotUrl = path;
      }

      // Insert booking as pending_verification
      const { data: bookingRow, error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          booking_ref: finalBookingId,
          booking_date: effectiveDate,
          start_time: sorted[0],
          end_time: endTime,
          court_id: courtDbId ?? null,
          court_name: effectiveCourt.name,
          customer_name: fullName,
          customer_phone: phoneNumber,
          customer_email: email || null,
          booking_status: 'pending',
          payment_method: 'qr_payment',
          payment_status: 'pending_verification',
          payment_reference: paymentReference.trim() || null,
          payment_screenshot_url: screenshotUrl,
          total_amount: totalDue,
        })
        .select('id')
        .single();

      if (bookingErr) {
        setIsProcessing(false);
        setBookingError('Something went wrong. Please try again.');
        return;
      }

      // Insert slots to block them while pending
      const slotRows = effectiveSlots.map((slotTime) => ({
        booking_id: bookingRow.id,
        court_id: courtDbId ?? null,
        slot_date: effectiveDate,
        slot_time: slotTime,
      }));
      const { error: slotsErr } = await supabase.from('booking_slots').insert(slotRows);

      if (slotsErr) {
        await supabase.from('bookings').delete().eq('id', bookingRow.id);
        setIsProcessing(false);
        setBookingError('One or more slots were just taken by another player. Please go back and pick different times.');
        return;
      }
    } else {
      await new Promise((r) => setTimeout(r, 1200));
    }

    await releaseHolds();

    // Save phone number to profile for next time
    if (isSupabaseEnabled && supabase && phoneNumber.trim()) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) supabase!.from('profiles').upsert({ id: user.id, phone: phoneNumber.trim() }, { onConflict: 'id' });
      });
    }

    // Notify admins of new payment submission
    notifyPaymentSubmitted({
      bookingRef: finalBookingId,
      courtName: effectiveCourt.name,
      customerEmail: email,
      customerName: fullName,
      date: effectiveDate,
      startTime: sorted[0],
      endTime,
    });

    const newBookingRecord: Booking = {
      id: finalBookingId,
      courtId: effectiveCourt.id,
      courtName: effectiveCourt.name,
      date: effectiveDate,
      startTime: sorted[0],
      endTime,
      slots: effectiveSlots,
      price: totalDue,
      status: 'Upcoming',
      fullName,
      phoneNumber,
      paymentMethod: 'GCash',
      createdAt: new Date().toISOString(),
    };

    onCompleteBooking(newBookingRecord);
    setIsProcessing(false);
    onNavigate('confirmed');
  };

  return (
    <div className="bg-[#f9f9f7] min-h-screen font-sans flex flex-col">
      {/* Header Bar */}
      <header className="bg-[#111412] text-white shrink-0 sticky top-0 z-40 shadow-sm">
        <div className="h-[3px] bg-[#00694c]" />
        <div className="px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => onNavigate('booking')}
          className="flex items-center gap-3 bg-transparent border-none cursor-pointer text-left"
        >
          <ChevronLeft className="w-5 h-5 text-white/40 hover:text-white" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00694c] flex items-center justify-center shrink-0">
              <span className="text-white font-black text-xs leading-none">S</span>
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight block">Sunshine <span className="font-medium text-white/50">Pickleball</span></span>
              <span className="font-mono text-[8px] uppercase tracking-widest text-[#6edba8] block font-semibold -mt-0.5">Change Schedule</span>
            </div>
          </div>
        </button>

        <div className="hidden md:flex items-center gap-3">
          <h1 className="text-sm font-sans font-bold text-white">Complete reservation checkout</h1>
          <button
            type="button"
            onClick={handleDemoFill}
            className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
          >
            ⚡ Demo Fill
          </button>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
          <span className="font-black text-[#6edba8] hidden md:block">SECURE PLATFORM</span>
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
            <button onClick={onOpenLogin} className="text-slate-300 hover:text-white transition-colors py-1 px-3 border border-slate-600 hover:border-slate-400 rounded text-xs">
              Log in
            </button>
          )}
        </div>
        </div>
      </header>

      {/* Grid Layout Area */}
      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-start">
        
        {/* Left Side: Client Data + Gateway Setup */}
        <form onSubmit={handlePaySubmit} className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Customer Info details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                  STEP 01
                </span>
                <h2 className="text-lg font-sans font-extrabold text-slate-900 mt-1.5">
                  Guest Details
                </h2>
              </div>

              {/* Quick social logins (Screen 6 / 7 behavior) */}
              {!isSocialLoggedIn ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Express Fill:</span>
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('Google')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-800 bg-white text-xs font-medium text-slate-700 hover:text-slate-900 transition-all cursor-pointer font-sans"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.518 4.114-5.147 4.114a5.53 5.53 0 0 1-5.53-5.53c0-3.053 2.477-5.53 5.53-5.53 1.408 0 2.69.525 3.676 1.385l3.125-3.124A9.92 9.92 0 0 0 12.24 2C6.58 2 2 6.58 2 12.24S6.58 22.48 12.24 22.48c5.787 0 10.158-4.062 10.158-10.158 0-.6-.053-1.18-.15-1.742H12.24Z"/></svg>
                    Google
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('Facebook')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-800 bg-white text-xs font-medium text-slate-700 hover:text-slate-900 transition-all cursor-pointer font-sans"
                  >
                    <svg className="w-3.5 h-3.5" fill="#1877F2" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Facebook
                  </button>
                </div>
              ) : (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-mono font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
                  <Check className="w-3 h-3" /> Profile Auto-Filled
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name input */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider block">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:border-[#00694c] focus:ring-1 focus:ring-[#00694c] outline-none transition-all"
                  />
                </div>
              </div>

              {/* Phone input */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider block">
                  Mobile Phone <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. +63 912 345 6789"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:border-[#00694c] focus:ring-1 focus:ring-[#00694c] outline-none transition-all"
                  />
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider block">
                  Email Address <span className="text-slate-400">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. juan@gmail.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:border-[#00694c] focus:ring-1 focus:ring-[#00694c] outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Payment */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-sm space-y-5">
            <div>
              <span className="font-mono text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                STEP 02
              </span>
              <h2 className="text-lg font-sans font-extrabold text-slate-900 mt-1.5">
                Payment
              </h2>
              <p className="text-xs text-slate-500 mt-1">Scan the QR below to pay, then provide your reference number or upload a screenshot of the receipt.</p>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-48 h-48 rounded-2xl border-2 border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shadow-sm">
                <img
                  src={QR_IMAGE_URL}
                  alt="Payment QR Code"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="text-center p-4"><div class="text-3xl mb-2">📱</div><p class="text-xs text-slate-400 font-mono">QR Code<br/>coming soon</p></div>';
                  }}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-700">GCash / Maya / Bank Transfer</p>
                <p className="text-xl font-black text-[#00694c] mt-0.5">₱{totalDue.toLocaleString()}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-4">
              {/* Reference Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider block">
                  Reference Number <span className="text-slate-400 normal-case">(required if no screenshot)</span>
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. GC-123456789"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-mono focus:bg-white focus:border-[#00694c] focus:ring-1 focus:ring-[#00694c] outline-none transition-all"
                />
              </div>

              {/* Screenshot Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider block">
                  Payment Screenshot <span className="text-slate-400 normal-case">(required if no reference)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleScreenshotChange(e.target.files?.[0] ?? null)}
                />
                {!screenshotPreview ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 py-6 border-2 border-dashed border-slate-300 hover:border-[#00694c] rounded-xl text-slate-500 hover:text-[#00694c] transition-all cursor-pointer bg-slate-50 hover:bg-[#00694c]/5"
                  >
                    <Upload className="w-6 h-6" />
                    <span className="text-xs font-semibold">Click to upload screenshot</span>
                    <span className="text-[10px] text-slate-400">PNG, JPG, JPEG accepted</span>
                  </button>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={screenshotPreview} alt="Payment screenshot" className="w-full max-h-48 object-contain" />
                    <button
                      type="button"
                      onClick={() => { handleScreenshotChange(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute top-2 right-2 bg-white/90 border border-slate-200 rounded-full p-1 text-slate-600 hover:text-red-500 shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border-t border-emerald-200">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-700">Screenshot uploaded</span>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-emerald-600 hover:underline ml-auto">Change</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Validation hint */}
              {!paymentReference.trim() && !screenshotFile && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Please provide a reference number or upload a screenshot to proceed.
                </p>
              )}
            </div>
          </div>

          {/* Secure payment message tag */}
          <div className="flex gap-2 p-3 bg-zinc-100 rounded-xl border border-zinc-200 text-[10px] text-slate-500 items-start">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p>Your payment credentials are fully encrypted using AES-256 standard protocols. We never store raw credit card details on server storage.</p>
          </div>

        </form>

        {/* Right Side: Sticky Checkout Pricing Summary (Screens 5-7 right panel) */}
        <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-4">
          
          {/* Holding timer overlay synchronized widget */}
          <div className="bg-[#BA1A1A]/10 text-[#BA1A1A] border border-[#BA1A1A]/20 p-4 rounded-xl flex gap-3 items-center text-xs">
            <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
            <div>
              <p className="font-bold leading-tight">We're holding your court for {formatTimer(cartTimeLeft)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6 space-y-5">
            <h3 className="font-sans font-black text-slate-900 text-base uppercase tracking-tight border-b border-zinc-100 pb-3">
              Order Detail
            </h3>

            {/* Court Specific Label Card */}
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-bold uppercase block w-fit">
                  {effectiveCourt.type} Court Facility
                </span>
                <h4 className="font-sans font-bold text-sm text-slate-900 mt-1.5">{effectiveCourt.name}</h4>
                <p className="text-xs text-slate-500 mt-1">{getReadableSelectedDate()}</p>
                <p className="text-xs font-semibold text-[#003d2b] mt-1 bg-[#bbead4] px-2 py-1 rounded w-fit">{getSelectedTimeRangeLabel()}</p>
              </div>

              <hr className="border-slate-100" />

              {/* Pricing billing list */}
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Court Fee ({hoursCount} hr{hoursCount > 1 ? 's' : ''})</span>
                  <span className="font-mono text-slate-900">₱{courtPrice}</span>
                </div>


                <div className="flex justify-between text-slate-900 pt-3 border-t border-slate-100 text-sm font-bold">
                  <span>Total Amount Due</span>
                  <span className="font-sans text-xl font-black text-slate-900 font-mono">₱{totalDue}</span>
                </div>
              </div>
            </div>

            {/* Core Authorization Action Button */}
            <div>
              {bookingError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex gap-2 items-start">
                  <span className="shrink-0">⚠</span>
                  <div>
                    <p className="font-bold">Booking Failed</p>
                    <p className="mt-0.5">{bookingError}</p>
                    {bookingError.includes('slots were just taken') && (
                      <button onClick={() => onNavigate('booking')} className="mt-1.5 text-red-800 font-bold underline">
                        Go back and pick new slots
                      </button>
                    )}
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={!isFormValid() || isProcessing}
                onClick={handlePaySubmit}
                className={`w-full py-4 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isFormValid() && !isProcessing
                    ? 'bg-[#00694c] hover:bg-[#005a40] text-white shadow-lg'
                    : 'bg-slate-150 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting…
                  </div>
                ) : (
                  <>
                    <span>Submit Payment — ₱{totalDue}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              
              <p className="text-[9px] font-mono text-slate-400 text-center mt-3 leading-normal">
                By completing transaction, you agree to the Sunshine Club reservation bylaws and cancel regulations. Rescheduling must occur 24 hours prior.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
