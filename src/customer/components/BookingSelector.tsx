import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, ShieldCheck, HelpCircle, ChevronLeft, ChevronRight, Info, AlertTriangle } from 'lucide-react';
import { Court, TimeSlot } from '../types';
import { COURTS as STATIC_COURTS, TIME_SLOTS_RAW } from '../data';
import { useRealtimeSlots } from '../../hooks/useRealtimeSlots';
import { isSupabaseEnabled, supabase } from '../../lib/supabase';

interface PricingRange { start: string; end: string; rate: number; courtId: number | null; }
interface CourtMeta { dbId: number; useGlobal: boolean; defaultPrice: number; name: string; surfaceType: string; status: string; imageUrl: string; }

// Returns the applicable rate for a given time slot from loaded pricing ranges
const getRateForSlot = (
  time: string,
  courtId: string,
  allRanges: PricingRange[],
  courtDbId: number | null,
  useGlobal: boolean,
  defaultRate: number
): number => {
  const [h] = time.split(':').map(Number);
  const slotMinutes = h * 60;

  const toMinutes = (t: string) => {
    const [hh, mm] = t.split(':').map(Number);
    return hh * 60 + (mm || 0);
  };

  const inRange = (r: PricingRange) => {
    const s = toMinutes(r.start);
    const e = toMinutes(r.end);
    if (e < s) return slotMinutes >= s || slotMinutes < e; // overnight
    return slotMinutes >= s && slotMinutes < e;
  };

  // Try court-specific pricing first (if not using global)
  if (!useGlobal && courtDbId) {
    const courtRange = allRanges.find(r => r.courtId === courtDbId && inRange(r));
    if (courtRange) return courtRange.rate;
  }

  // Fall back to global pricing
  const globalRange = allRanges.find(r => r.courtId === null && inRange(r));
  if (globalRange) return globalRange.rate;

  return defaultRate;
};

interface BookingSelectorProps {
  onNavigate: (screen: 'landing' | 'booking' | 'checkout' | 'confirmed' | 'bookings-list' | 'booking-detail') => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedCourtId: string;
  setSelectedCourtId: (courtId: string) => void;
  selectedSlots: string[];
  setSelectedSlots: (slots: string[]) => void;
  cartTimeLeft: number;
  setCartTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  onOpenLogin: () => void;
  role: 'user' | 'admin' | null;
  onLogout: () => void;
  currentUser?: { name: string; email: string; avatar?: string; } | null;
  onFinalPriceChange?: (price: number) => void;
  onCourtDbIdChange?: (id: number | null) => void;
}

// Generate the dates slider starting from today
const getDatesSlider = () => {
  const dates = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < 5; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    dates.push({
      dateStr,
      dayName: daysOfWeek[d.getDay()],
      dayNumber: d.getDate(),
      monthName: months[d.getMonth()],
      isToday: i === 0,
    });
  }
  return dates;
};

// Generates occupied slots for illustrative purposes
const getBookedStatusForSlot = (time: string, courtId: string, date: string): { isBooked: boolean, bookerName?: string } => {
  // Let's mock a few bookings to make the dashboard feel alive and interactive
  const hash = time + courtId + date;
  
  // Specific mock to align with Screen 2 and 3:
  // e.g. Oct 13, Court 1 - Morning has Oliver booking 08:00 AM, and some Afternoon bookings.
  if (date === '2026-10-13') {
    if (courtId === 'court-1') {
      if (time === '08:00') return { isBooked: true, bookerName: 'Oliver P.' };
      if (time === '11:00') return { isBooked: true, bookerName: 'Samantha R.' };
      if (time === '14:00') return { isBooked: true, bookerName: 'Dave C.' };
      if (time === '18:00') return { isBooked: true, bookerName: 'BGC Ladder Tourney' };
    }
    if (courtId === 'court-2') {
      if (time === '07:00' || time === '08:00') return { isBooked: true, bookerName: 'Mark L.' };
      if (time === '17:00') return { isBooked: true, bookerName: 'Coach Alvin' };
    }
  } else {
    // Just pseudo-random mock
    const charSum = hash.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    if (charSum % 5 === 0) {
      return { isBooked: true, bookerName: 'Booked' };
    }
  }

  return { isBooked: false };
};

export default function BookingSelector({
  onNavigate,
  selectedDate,
  setSelectedDate,
  selectedCourtId,
  setSelectedCourtId,
  selectedSlots,
  setSelectedSlots,
  cartTimeLeft,
  setCartTimeLeft,
  onOpenLogin,
  role,
  currentUser,
  onLogout,
  onFinalPriceChange,
  onCourtDbIdChange,
}: BookingSelectorProps) {
  const [activePeriodFilter, setActivePeriodFilter] = useState<'All' | 'Morning' | 'Afternoon' | 'Evening' | 'Night'>('All');
  const [pricingRanges, setPricingRanges] = useState<PricingRange[]>([]);
  const [courtMeta, setCourtMeta] = useState<Record<string, CourtMeta>>({});
  const [activeSlugs, setActiveSlugs] = useState<string[]>([]);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const sliderDates = getDatesSlider();
  const isCustomDate = !sliderDates.some(d => d.dateStr === selectedDate);

  // Load courts + pricing from Supabase
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    const load = async () => {
      const { data: courts } = await supabase.from('courts').select('id, slug, name, surface_type, default_price, use_global_pricing, status, image_url').neq('status', 'inactive');
      const { data: pricing } = await supabase.from('court_pricing').select('court_id, start_time, end_time, rate');

      if (courts) {
        const meta: Record<string, CourtMeta> = {};
        const slugs: string[] = [];
        courts.forEach((c: any) => {
          meta[c.slug] = { dbId: c.id, useGlobal: c.use_global_pricing ?? true, defaultPrice: Number(c.default_price), name: c.name, surfaceType: c.surface_type ?? '', status: c.status ?? 'active', imageUrl: c.image_url ?? '' };
          slugs.push(c.slug);
        });
        setCourtMeta(meta);
        setActiveSlugs(slugs);
        // If selected court is no longer active, switch to first active
        const current = courts.find((c: any) => c.slug === selectedCourtId);
        if (current) {
          onCourtDbIdChange?.(current.id);
        } else if (courts.length > 0) {
          setSelectedCourtId(courts[0].slug);
          onCourtDbIdChange?.(courts[0].id);
        }
      }

      if (pricing) {
        setPricingRanges(pricing.map((r: any) => ({
          courtId: r.court_id,
          start: r.start_time.slice(0, 5),
          end: r.end_time.slice(0, 5),
          rate: Number(r.rate),
        })));
      }
    };
    load();
  }, []);

  // Show all non-inactive courts (active + maintenance)
  const COURTS = activeSlugs.length > 0
    ? STATIC_COURTS.filter(c => activeSlugs.includes(c.id))
    : STATIC_COURTS;
  const selectedCourt = COURTS.find(c => c.id === selectedCourtId) || COURTS[0];

  // Get effective price for a given time slot
  const getSlotRate = (time: string): number => {
    const meta = courtMeta[selectedCourtId];
    if (!meta || pricingRanges.length === 0) return selectedCourt.pricePerHour;
    return getRateForSlot(time, selectedCourtId, pricingRanges, meta.dbId, meta.useGlobal, meta.defaultPrice);
  };

  // Get the rate that applies RIGHT NOW for a given court (for the court card display)
  const getCurrentRateForCourt = (courtSlug: string): number => {
    const meta = courtMeta[courtSlug];
    if (!meta || pricingRanges.length === 0) return meta?.defaultPrice ?? 300;
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:00`;
    return getRateForSlot(currentTime, courtSlug, pricingRanges, meta.dbId, meta.useGlobal, meta.defaultPrice);
  };

  // Live slot availability from Supabase — overrides mock data when connected
  const realtimeBookedSlots = useRealtimeSlots(selectedCourtId, selectedDate);

  const isSlotBooked = (time: string): boolean => {
    if (isSupabaseEnabled) return realtimeBookedSlots.has(time);
    return getBookedStatusForSlot(time, selectedCourtId, selectedDate).isBooked;
  };

  // Cart Hold countdown timer logic
  useEffect(() => {
    if (selectedSlots.length === 0) return;
    
    const timer = setInterval(() => {
      setCartTimeLeft((prev) => {
        if (prev <= 1) {
          // Reset slots upon expiry
          setSelectedSlots([]);
          return 600; // Reset to 10m
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedSlots, setCartTimeLeft, setSelectedSlots]);

  const formatHoldTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Returns the hour integer from "HH:MM" string
  const toHour = (t: string) => parseInt(t.split(':')[0]);

  // Determine which slots can be toggled given current selection (must stay contiguous)
  const isSlotSelectable = (time: string): boolean => {
    if (selectedSlots.length === 0) return true;
    const sorted = [...selectedSlots].sort();
    const minH = toHour(sorted[0]);
    const maxH = toHour(sorted[sorted.length - 1]);
    const h = toHour(time);
    // Can deselect from either end, or extend one step beyond current block
    return h === minH - 1 || h === maxH + 1 || selectedSlots.includes(time);
  };

  const handleSlotToggle = (time: string, isBooked: boolean) => {
    if (isBooked) return;
    if (!isSlotSelectable(time)) return;

    if (selectedSlots.includes(time)) {
      const sorted = [...selectedSlots].sort();
      const minH = toHour(sorted[0]);
      const maxH = toHour(sorted[sorted.length - 1]);
      const h = toHour(time);
      // Only allow deselecting from either end to keep block contiguous
      if (h === minH || h === maxH) {
        setSelectedSlots(selectedSlots.filter(s => s !== time));
      }
    } else {
      setSelectedSlots([...selectedSlots, time].sort());
    }
  };

  const clearSelection = () => {
    setSelectedSlots([]);
  };

  // Compute price per slot (time-based) and total
  const totalHours = selectedSlots.length;
  const courtFee = selectedSlots.reduce((sum, time) => sum + getSlotRate(time), 0);
  const discount = totalHours > 2 ? 50 : 0;
  const finalPrice = Math.max(0, courtFee - discount);

  // Keep parent in sync
  useEffect(() => { onFinalPriceChange?.(finalPrice); }, [finalPrice]);
  useEffect(() => { onCourtDbIdChange?.(courtMeta[selectedCourtId]?.dbId ?? null); }, [selectedCourtId, courtMeta]);

  // Formats selected times interval for summary display
  const getSelectedTimeRangeLabel = () => {
    if (selectedSlots.length === 0) return 'No slots selected';
    const sorted = [...selectedSlots].sort();
    
    // Convert 24h string to AM/PM labels
    const formatTimeLabel = (t: string) => {
      const [h, m] = t.split(':');
      const hourVal = parseInt(h);
      const suffix = hourVal >= 12 ? 'PM' : 'AM';
      const displayH = hourVal % 12 === 0 ? 12 : hourVal % 12;
      return `${displayH}:${m} ${suffix}`;
    };

    const firstTime = sorted[0];
    const lastTime = sorted[sorted.length - 1];

    // Compute end time (adds 1 hour to start slot)
    const [lastH, lastM] = lastTime.split(':');
    const endHVal = parseInt(lastH) + 1;
    const endTimeStr = `${endHVal.toString().padStart(2, '0')}:${lastM}`;
    
    return `${formatTimeLabel(firstTime)} - ${formatTimeLabel(endTimeStr)}`;
  };

  // Format date readable
  const getReadableSelectedDate = () => {
    const d = new Date(selectedDate);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredSlots = TIME_SLOTS_RAW.filter(slot => {
    if (activePeriodFilter === 'All') return true;
    return slot.period === activePeriodFilter;
  });

  return (
    <div className="bg-[#f9f9f7] min-h-screen font-sans flex flex-col">
      {/* Header Bar */}
      <header className="bg-[#111412] text-white shrink-0 sticky top-0 z-40 shadow-sm">
        <div className="h-[3px] bg-[#00694c]" />
        <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('landing')}>
          <ChevronLeft className="w-5 h-5 text-white/40 hover:text-white" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00694c] flex items-center justify-center shrink-0">
              <span className="text-white font-black text-xs leading-none">S</span>
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight block">Sunshine <span className="font-medium text-white/50">Pickleball</span></span>
              <span className="font-mono text-[8px] uppercase tracking-widest text-[#6edba8] block font-semibold -mt-0.5">Reserve Court</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-xs font-mono">
          <button
            onClick={() => onNavigate('bookings-list')}
            className="text-slate-300 hover:text-white transition-colors py-1 px-3 bg-zinc-800/80 rounded"
          >
            My Bookings
          </button>
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
            <button onClick={onOpenLogin} className="text-slate-300 hover:text-white transition-colors py-1 px-3 border border-slate-600 hover:border-slate-400 rounded">
              Log in
            </button>
          )}
        </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1">
        
        {/* Left Side: Selectors Grid */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-sm space-y-5">
            
            {/* Step 1: Select Date */}
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                  STEP 01
                </span>
                <span className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-[#05140B]" /> Pick Playing Date
                </span>
              </div>
              <h2 className="text-xl font-sans font-extrabold text-[#05140B] mb-4">
                Select reservation date
              </h2>

              {/* Horizontal Date Slider */}
              <div className="flex gap-2.5 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-300">
                {sliderDates.map((item) => {
                  const isMarkedSelected = selectedDate === item.dateStr;
                  return (
                    <button
                      key={item.dateStr}
                      onClick={() => {
                        setSelectedDate(item.dateStr);
                        // Changing date resets current selection draft to avoid overlap conflict
                        clearSelection();
                      }}
                      className={`flex flex-col items-center justify-center p-3.5 rounded-xl border min-w-[70px] shrink-0 transition-all cursor-pointer ${
                        isMarkedSelected 
                          ? 'bg-[#00694c] border-[#00694c] text-white shadow-md'
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className={`text-[10px] font-mono tracking-wider font-semibold uppercase ${isMarkedSelected ? 'text-[#6edba8]' : 'text-slate-500'}`}>
                        {item.dayName}
                      </span>
                      <span className="text-xl font-black font-sans leading-none mt-1">
                        {item.dayNumber}
                      </span>
                      <span className="text-[9px] font-mono mt-1 opacity-70">
                        {item.monthName}
                      </span>
                    </button>
                  );
                })}

                {/* Custom date chip — shown when a date outside the 5-day slider is selected */}
                {isCustomDate && (() => {
                  const d = new Date(selectedDate + 'T00:00:00');
                  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  return (
                    <div className="flex flex-col items-center justify-center p-3.5 rounded-xl border min-w-[70px] shrink-0 bg-[#00694c] border-[#00694c] text-white shadow-md">
                      <span className="text-[10px] font-mono tracking-wider font-semibold uppercase text-[#6edba8]">{days[d.getDay()]}</span>
                      <span className="text-xl font-black font-sans leading-none mt-1">{d.getDate()}</span>
                      <span className="text-[9px] font-mono mt-1 opacity-70">{months[d.getMonth()]}</span>
                    </div>
                  );
                })()}

                {/* Calendar picker button */}
                <button
                  type="button"
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="relative flex flex-col items-center justify-center p-3.5 rounded-xl border min-w-[70px] shrink-0 border-dashed border-slate-300 hover:border-[#00694c] bg-slate-50 hover:bg-[#00694c]/5 text-slate-500 hover:text-[#00694c] transition-all cursor-pointer"
                >
                  <CalendarIcon className="w-5 h-5 mb-1" />
                  <span className="text-[9px] font-mono font-medium uppercase">Pick date</span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedDate(e.target.value);
                        clearSelection();
                      }
                    }}
                    className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
                  />
                </button>
              </div>
            </div>

            <hr className="border-slate-200/60" />

            {/* Step 2: Select Court */}
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                  STEP 02
                </span>
                <span className="text-xs font-mono text-slate-500">Pick court coordinate</span>
              </div>
              <h2 className="text-xl font-sans font-extrabold text-[#05140B] mb-4">
                Choose active court layout
              </h2>

              {/* Court List Tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {COURTS.map((court) => {
                  const isMarkedSelected = selectedCourtId === court.id;
                  const isMaintenance = courtMeta[court.id]?.status === 'maintenance';
                  return (
                    <button
                      key={court.id}
                      disabled={isMaintenance}
                      onClick={() => {
                        if (isMaintenance) return;
                        setSelectedCourtId(court.id);
                        clearSelection();
                      }}
                      className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                        isMaintenance
                          ? 'bg-amber-50 border-amber-200 cursor-not-allowed opacity-70'
                          : isMarkedSelected
                            ? 'bg-[#e8f5ee]/70 border-[#00694c] shadow-sm transform scale-[1.01] cursor-pointer'
                            : 'bg-slate-100 hover:bg-slate-250 border-slate-200 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                          {courtMeta[court.id]?.surfaceType || court.type}
                        </span>
                        {isMaintenance
                          ? <span className="text-[9px] font-mono font-bold uppercase text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Maintenance</span>
                          : isMarkedSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#00694c]" />
                        }
                      </div>
                      <h4 className={`font-sans font-bold text-xs mt-1 leading-tight shrink-0 ${isMaintenance ? 'text-slate-400' : 'text-slate-900'}`}>
                        {courtMeta[court.id]?.name || court.name}
                      </h4>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/60 w-full text-[10px] font-mono">
                        {isMaintenance
                          ? <span className="text-amber-500 font-bold">Unavailable</span>
                          : <span className="font-black text-[#00694c]">₱{getCurrentRateForCourt(court.id)}/hr</span>
                        }
                        <span className="text-slate-400">★ {court.rating}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Court Spotlight Detail */}
              <div className="bg-[#f0f4f1] text-[#1a1c1b] p-4 rounded-xl border border-[#bccac1] flex flex-col md:flex-row gap-4 items-center mt-4">
                <img
                  src={courtMeta[selectedCourtId]?.imageUrl || selectedCourt.image}
                  alt={selectedCourt.name}
                  className="w-full md:w-28 h-20 object-cover rounded-lg shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="space-y-1 w-full text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <h3 className="font-sans font-extrabold text-sm text-[#1a1c1b]">{courtMeta[selectedCourtId]?.name || selectedCourt.name}</h3>
                    <span className="text-[9px] font-mono bg-[#00694c]/15 text-[#005a40] px-1.5 py-0.5 rounded font-bold uppercase">{courtMeta[selectedCourtId]?.surfaceType || selectedCourt.type} Layout</span>
                  </div>
                  <p className="text-xs text-[#3d4943] leading-relaxed max-w-xl">{selectedCourt.description}</p>
                </div>
              </div>
            </div>

            <hr className="border-slate-200/60" />

            {/* Step 3: Select Time Slots */}
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                  STEP 03
                </span>
                <span className="text-xs font-mono text-slate-500">Pick hours of operation</span>
              </div>
              <h2 className="text-xl font-sans font-extrabold text-[#05140B] mb-4">
                Available playing schedules on <span className="text-[#00694c]">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </h2>

              {/* Interval period selector tabs */}
              <div className="flex gap-1.5 border-b border-slate-200/80 pb-3 mb-4 overflow-x-auto">
                {(['All', 'Morning', 'Afternoon', 'Evening', 'Night'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setActivePeriodFilter(period)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer shrink-0 ${
                      activePeriodFilter === period
                        ? 'bg-[#00694c] text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {period === 'All' && 'All'}
                    {period === 'Morning' && 'Morning (6AM–12PM)'}
                    {period === 'Afternoon' && 'Afternoon (12PM–6PM)'}
                    {period === 'Evening' && 'Evening (6PM–12MN)'}
                    {period === 'Night' && 'Night (12AM–6AM)'}
                  </button>
                ))}
              </div>

              {/* Time grid table */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredSlots.map((slot) => {
                  const slotBooked = isSlotBooked(slot.time);
                  const mockInfo = isSupabaseEnabled ? null : getBookedStatusForSlot(slot.time, selectedCourtId, selectedDate);
                  const bookerLabel = mockInfo?.bookerName ?? 'Booked';
                  const isSlotCurrentlySelected = selectedSlots.includes(slot.time);
                  const selectable = !slotBooked && isSlotSelectable(slot.time);
                  const nonContiguous = !slotBooked && !selectable;

                  return (
                    <button
                      key={slot.time}
                      disabled={slotBooked || nonContiguous}
                      onClick={() => handleSlotToggle(slot.time, slotBooked)}
                      title={nonContiguous ? 'Select consecutive slots only' : undefined}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all text-left relative overflow-hidden ${
                        slotBooked
                          ? 'bg-zinc-100 border-zinc-200 text-slate-400 cursor-not-allowed opacity-60'
                          : isSlotCurrentlySelected
                            ? 'bg-[#00694c] border-[#00694c] text-white font-bold shadow-md ring-2 ring-[#00694c]/10'
                            : nonContiguous
                              ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-40'
                              : 'bg-white hover:border-[#00694c] border-slate-200 text-slate-800 cursor-pointer'
                      }`}
                    >
                      <div>
                        <div className="text-[11px] font-mono leading-none tracking-tight">
                          {slot.label}
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1 leading-none">
                          {slotBooked ? bookerLabel : `₱${getSlotRate(slot.time)}/hr`}
                        </div>
                      </div>

                      {slotBooked ? (
                        <span className="text-[9px] font-mono bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded font-black uppercase">
                          Booked
                        </span>
                      ) : isSlotCurrentlySelected ? (
                        <span className="text-[9px] font-mono bg-[#00694c] text-white px-1.5 py-0.5 rounded font-black uppercase">
                          Added
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono bg-slate-900/5 hover:bg-slate-900/10 text-slate-700 px-1.5 py-0.5 rounded font-semibold uppercase">
                          Open
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend support label help instructions */}
              <div className="flex gap-4 items-center justify-center mt-5 pt-4 border-t border-slate-100 text-[10px] font-mono text-slate-500">
                <p className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-white border border-slate-300 block" /> Available
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#00694c] block" /> Selected
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-zinc-200 border border-zinc-300 block" /> Booked
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* Right Side: Sticky Checkout Summary Panel (Screen 2 / 3 Panel) */}
        <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-4">
          
          {/* Reservation Hold Alert Banner */}
          {selectedSlots.length > 0 && (
            <div className="bg-[#BA1A1A]/10 text-[#BA1A1A] border border-[#BA1A1A]/20 p-4 rounded-xl flex gap-3 items-start p-3 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Slots Held Pending Checkout</p>
                <p className="text-[11px] opacity-90 mt-0.5">We are locking these slots for you. Cart will release in <span className="font-mono font-bold text-[#BA1A1A]">{formatHoldTime(cartTimeLeft)}</span> minutes.</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-5 md:p-6 space-y-5">
            <h3 className="font-sans font-black text-base text-slate-900 border-b border-slate-100 pb-3 uppercase tracking-tight flex items-center justify-between">
              Booking Summary
              {selectedSlots.length > 0 && (
                <button 
                  onClick={clearSelection}
                  className="text-[10px] uppercase font-mono text-[#BA1A1A] font-bold hover:underline bg-transparent border-none cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </h3>

            {/* Selected Court Block representation */}
            <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <img
                src={courtMeta[selectedCourtId]?.imageUrl || selectedCourt.image}
                alt={selectedCourt.name}
                className="w-14 h-14 object-cover rounded-md border border-slate-200/60 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <span className="text-[9px] font-mono text-slate-400 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded font-bold uppercase">{courtMeta[selectedCourtId]?.surfaceType || selectedCourt.type} Facility</span>
                <h4 className="font-sans font-bold text-xs text-slate-900 mt-1 truncate">{courtMeta[selectedCourtId]?.name || selectedCourt.name}</h4>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">★ {selectedCourt.rating} rating</div>
              </div>
            </div>

            {/* Selected Date Details */}
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-mono text-slate-400 uppercase tracking-wider text-[10px]">Date</span>
                <span className="font-semibold text-slate-900">{getReadableSelectedDate()}</span>
              </div>

              <div className="flex justify-between items-start text-slate-600">
                <span className="font-mono text-slate-400 uppercase tracking-wider text-[10px] mt-0.5">Chosen Time</span>
                <div className="text-right">
                  <span className="font-semibold text-slate-950 block">{getSelectedTimeRangeLabel()}</span>
                  <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">{selectedSlots.length > 0 ? `(${selectedSlots.length} hour${selectedSlots.length > 1 ? 's' : ''} total block)` : 'No hours selected'}</span>
                </div>
              </div>

              {selectedSlots.length > 0 && (
                <div className="bg-emerald-500/5 text-emerald-800 border border-emerald-500/10 p-2.5 rounded-lg text-[10px] font-mono flex items-center gap-1.5 font-medium leading-normal">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Price includes free paddle rentals for all 4 players!
                </div>
              )}
            </div>

            {/* Invoicing Breakdown */}
            <hr className="border-slate-100" />
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Court Base Fee</span>
                <span className="font-mono text-slate-900 font-semibold">
                  {selectedSlots.length > 0 ? `₱${courtFee}` : '₱0'}
                </span>
              </div>
              {selectedSlots.length > 0 && (
                <div className="text-[10px] text-slate-400 font-mono -mt-1 text-right">
                  {selectedSlots.map(t => `${t} = ₱${getSlotRate(t)}`).join(' · ')}
                </div>
              )}
              <div className="flex justify-between">
                <span>Rental Gear Allowance</span>
                <span className="text-emerald-600 font-semibold uppercase font-mono">Free</span>
              </div>
              
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Loyalty Discount (2+ hrs)</span>
                  <span className="font-mono font-semibold">-₱{discount}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-900 pt-2 border-t border-slate-100 text-sm font-bold">
                <span>Subtotal Price</span>
                <span className="font-sans text-lg font-black text-slate-900 font-mono">₱{finalPrice}</span>
              </div>
            </div>

            {/* Check Out Call to Actions */}
            <div>
              <button
                onClick={() => onNavigate('checkout')}
                disabled={selectedSlots.length === 0}
                className={`w-full py-4 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  selectedSlots.length > 0
                    ? 'bg-[#00694c] hover:bg-[#005a40] text-white shadow-lg shadow-[#00694c]/10 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Proceed to Checkout
              </button>
              
              <p className="text-[10px] font-mono text-slate-400 text-center mt-3 leading-normal">
                Slots are locked in real-time. Final price is in Philippine Pesos (P) inclusive of all processing taxes.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
