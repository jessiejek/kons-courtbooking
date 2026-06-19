import React, { useState, useEffect } from 'react';
import { Plus, X, Calendar, Users, TrendingUp, LayoutGrid } from 'lucide-react';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import { Court } from '../types';

interface WalkinViewProps {
  courts: Court[];
  onWalkinCreated: () => void;
  toast: (type: 'success' | 'error' | 'warning', title: string, desc?: string) => void;
}

interface SlotBooking {
  booking_ref: string;
  customer_name: string;
  start_time: string;
  end_time: string;
  booking_status: string;
  payment_method: string;
  total_amount: number;
  is_walkin?: boolean;
}

const HOURS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6;
  return `${h.toString().padStart(2, '0')}:00`;
});

function fmtHour(t: string) {
  const h = parseInt(t.split(':')[0]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${suffix}`;
}

function fmtTime(t: string) {
  const [hh, mm] = t.split(':');
  const h = parseInt(hh);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${mm} ${suffix}`;
}

function toH(t: string) { return parseInt(t.split(':')[0]); }

export default function WalkinView({ courts, onWalkinCreated, toast }: WalkinViewProps) {
  const today = new Date().toISOString().split('T')[0];
  const [viewDate, setViewDate] = useState(today);
  const [allBookings, setAllBookings] = useState<(SlotBooking & { court_id: number })[]>([]);
  const [loading, setLoading] = useState(false);

  // Per-court slot selection: courtId → selected hour strings
  const [courtSelections, setCourtSelections] = useState<Record<number, string[]>>({});

  const [showForm, setShowForm] = useState(false);
  const [nbCourtId, setNbCourtId] = useState<number>(courts[0]?.id ?? 1);
  const [nbCustomer, setNbCustomer] = useState('');
  const [nbPhone, setNbPhone] = useState('');
  const [nbStart, setNbStart] = useState('09:00');
  const [nbEnd, setNbEnd] = useState('10:00');
  const [nbAmount, setNbAmount] = useState(300);
  const [nbPayment, setNbPayment] = useState<'cash' | 'gcash'>('cash');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadSchedule(); }, [viewDate]);

  const loadSchedule = async () => {
    if (!isSupabaseEnabled || !supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select('booking_ref, customer_name, start_time, end_time, booking_status, payment_method, total_amount, court_id')
      .eq('booking_date', viewDate)
      .neq('booking_status', 'cancelled')
      .order('start_time');
    setLoading(false);
    if (error) { console.error(error); return; }
    setAllBookings((data ?? []).map((b: any) => ({
      ...b,
      is_walkin: b.booking_ref?.startsWith('WI-'),
    })));
    setCourtSelections({});
  };

  const getCourtBookings = (courtId: number) =>
    allBookings.filter(b => b.court_id === courtId);

  const isHourBooked = (bookings: (SlotBooking & { court_id: number })[], hour: string) => {
    const h = toH(hour);
    return bookings.find(b => {
      const start = toH(b.start_time);
      const end = toH(b.end_time);
      return h >= start && h < end;
    }) ?? null;
  };

  const getSelectedForCourt = (courtId: number) => courtSelections[courtId] ?? [];

  const isSlotSelectable = (courtId: number, hour: string): boolean => {
    const sel = getSelectedForCourt(courtId);
    if (sel.length === 0) return true;
    const sorted = [...sel].sort();
    const minH = toH(sorted[0]);
    const maxH = toH(sorted[sorted.length - 1]);
    const h = toH(hour);
    return h === minH - 1 || h === maxH + 1 || sel.includes(hour);
  };

  const handleSlotClick = (courtId: number, hour: string, booked: boolean) => {
    if (booked) return;
    const sel = getSelectedForCourt(courtId);
    if (!isSlotSelectable(courtId, hour)) return;

    let next: string[];
    if (sel.includes(hour)) {
      const sorted = [...sel].sort();
      const minH = toH(sorted[0]);
      const maxH = toH(sorted[sorted.length - 1]);
      const h = toH(hour);
      if (h === minH || h === maxH) {
        next = sel.filter(s => s !== hour);
      } else {
        return;
      }
    } else {
      next = [...sel, hour].sort();
    }
    setCourtSelections(prev => ({ ...prev, [courtId]: next }));
  };

  const openFormForCourt = (courtId: number) => {
    const sel = getSelectedForCourt(courtId).sort();
    const court = courts.find(c => c.id === courtId) ?? courts[0];
    setNbCourtId(courtId);
    if (sel.length > 0) {
      const startH = toH(sel[0]);
      const endH = toH(sel[sel.length - 1]) + 1;
      setNbStart(`${startH.toString().padStart(2, '0')}:00`);
      setNbEnd(`${endH.toString().padStart(2, '0')}:00`);
      setNbAmount(sel.length * (court.defaultPrice ?? 300));
    } else {
      setNbStart('09:00');
      setNbEnd('10:00');
      setNbAmount(court.defaultPrice ?? 300);
    }
    setNbCustomer('');
    setNbPhone('');
    setNbPayment('cash');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nbCustomer.trim() || !nbPhone.trim()) { toast('warning', 'Missing fields', 'Customer name and phone are required.'); return; }
    if (!isSupabaseEnabled || !supabase) return;
    setSubmitting(true);
    const court = courts.find(c => c.id === nbCourtId) ?? courts[0];
    const ref = `WI-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.from('bookings').insert({
      booking_ref: ref,
      booking_date: viewDate,
      start_time: nbStart,
      end_time: nbEnd,
      court_id: court.id,
      court_name: court.name,
      customer_name: nbCustomer,
      customer_phone: nbPhone,
      booking_status: 'confirmed',
      payment_method: nbPayment,
      payment_status: 'paid',
      total_amount: nbAmount,
    });
    setSubmitting(false);
    if (error) { toast('error', 'Failed to save', error.message); return; }
    toast('success', 'Walk-in confirmed', `${nbCustomer} — ${court.name} ${fmtTime(nbStart)} → ${fmtTime(nbEnd)}`);
    setShowForm(false);
    setCourtSelections(prev => ({ ...prev, [nbCourtId]: [] }));
    await loadSchedule();
    onWalkinCreated();
  };

  const activeCourts = courts.filter(c => c.status !== 'inactive');
  const totalBookings = allBookings.length;
  const walkinCount = allBookings.filter(b => b.is_walkin).length;
  const nowH = new Date().getHours();
  const occupiedNow = activeCourts.filter(c =>
    getCourtBookings(c.id).some(b => nowH >= toH(b.start_time) && nowH < toH(b.end_time))
  ).length;
  const totalRevenue = allBookings.reduce((s, b) => s + Number(b.total_amount), 0);

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">Walk-in counter</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Click open slots to select a time range, then press <strong>+ Add walk-in</strong>.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={viewDate}
            onChange={e => setViewDate(e.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium bg-surface focus:border-primary focus:ring-0"
          />
          <button
            onClick={() => openFormForCourt(courts.find(c => c.status === 'active')?.id ?? courts[0]?.id)}
            className="flex items-center gap-2 bg-primary text-white font-bold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New walk-in
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total bookings today', value: totalBookings, icon: Calendar },
          { label: 'Walk-ins', value: walkinCount, icon: Users },
          { label: 'Courts occupied now', value: `${occupiedNow} / ${activeCourts.length}`, icon: LayoutGrid },
          { label: 'Revenue today', value: `₱${totalRevenue.toLocaleString()}`, icon: TrendingUp },
        ].map(s => (
          <div key={s.label} className="bg-white border border-outline-variant/40 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-3.5 h-3.5 text-outline" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{s.label}</span>
            </div>
            <div className="text-2xl font-extrabold text-on-surface">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Court schedule */}
      <div>
        <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
          Court schedule — {new Date(viewDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          {loading && <span className="ml-2 font-normal normal-case animate-pulse">Loading…</span>}
        </div>

        <div className="space-y-4">
          {activeCourts.map(court => {
            const bookings = getCourtBookings(court.id);
            const isMaintenance = court.status === 'maintenance';
            const isOccupiedNow = bookings.some(b => nowH >= toH(b.start_time) && nowH < toH(b.end_time) && viewDate === today);
            const sel = getSelectedForCourt(court.id);
            const hasSelection = sel.length > 0;

            return (
              <div key={court.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all duration-150 ${
                hasSelection ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant/60'
              } ${isMaintenance ? 'opacity-50' : ''}`}>

                {/* Court header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-surface-container-low/40 border-b border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-black text-sm">{court.id}</span>
                    </div>
                    <span className="font-bold text-sm text-on-surface">{court.name}</span>
                    <span className="text-[10px] font-mono uppercase bg-surface-container text-on-surface-variant border border-outline-variant/50 px-1.5 py-0.5 rounded">
                      {court.surfaceType}
                    </span>
                    {isMaintenance && (
                      <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">maintenance</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-on-surface-variant">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</span>
                    {viewDate === today && (
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                        isOccupiedNow
                          ? 'bg-[#e8f5ee] text-[#005a40] border border-[#9FE1CB]'
                          : 'bg-surface-container text-on-surface-variant border border-outline-variant/50'
                      }`}>
                        {isOccupiedNow ? '● occupied now' : 'open now'}
                      </span>
                    )}
                    {hasSelection && (
                      <span className="text-[11px] text-primary font-bold">
                        {sel.length}h · {fmtHour(sel.sort()[0])} – {fmtHour(`${(toH(sel.sort()[sel.length - 1]) + 1).toString().padStart(2, '0')}:00`)}
                      </span>
                    )}
                    {!isMaintenance && (
                      <button
                        onClick={() => openFormForCourt(court.id)}
                        className={`flex items-center gap-1.5 text-[12px] font-bold px-4 py-2 rounded-lg border transition-all ${
                          hasSelection
                            ? 'bg-primary text-white border-primary shadow-md scale-[1.03]'
                            : 'text-primary border-primary/30 hover:bg-primary/5'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add walk-in{hasSelection ? ` (${sel.length}h)` : ''}
                      </button>
                    )}
                  </div>
                </div>

                {/* Hour grid — bigger cells */}
                <div className="px-5 py-4 overflow-x-auto">
                  <div className="flex gap-2 min-w-max">
                    {HOURS.map(hour => {
                      const booking = isHourBooked(bookings, hour);
                      const isCurrentHour = toH(hour) === nowH && viewDate === today;
                      const isSelected = sel.includes(hour);
                      const selectable = !booking && isSlotSelectable(court.id, hour);
                      const isWalkin = booking?.is_walkin;
                      const nonContiguous = !booking && !isSelected && !selectable;

                      let cellClass = '';
                      let hourLabelClass = '';
                      let subText = '';
                      let subClass = '';

                      if (booking) {
                        cellClass = isWalkin
                          ? 'bg-amber-50 border-amber-300 cursor-default'
                          : 'bg-[#e8f5ee] border-[#9FE1CB] cursor-default';
                        hourLabelClass = isWalkin ? 'text-amber-700 font-bold' : 'text-[#005a40] font-bold';
                        subText = booking.customer_name.split(' ')[0];
                        subClass = isWalkin ? 'text-amber-600 text-[10px] font-semibold' : 'text-[#3d4943] text-[10px] font-semibold';
                      } else if (isSelected) {
                        cellClass = 'bg-primary border-primary shadow-lg cursor-pointer ring-2 ring-primary/30';
                        hourLabelClass = 'text-white font-bold';
                        subText = 'selected';
                        subClass = 'text-white/80 text-[10px]';
                      } else if (nonContiguous) {
                        cellClass = 'bg-slate-50 border-slate-100 cursor-not-allowed opacity-35';
                        hourLabelClass = 'text-slate-400';
                        subText = 'open';
                        subClass = 'text-slate-300 text-[10px]';
                      } else if (isCurrentHour) {
                        cellClass = 'bg-amber-50 border-amber-300 cursor-pointer hover:border-amber-400 hover:bg-amber-100';
                        hourLabelClass = 'text-amber-700 font-semibold';
                        subText = 'now · open';
                        subClass = 'text-amber-600 text-[10px] font-medium';
                      } else {
                        cellClass = 'bg-white border-outline-variant/50 cursor-pointer hover:border-primary hover:bg-primary/5 hover:shadow-sm';
                        hourLabelClass = 'text-on-surface-variant';
                        subText = 'open';
                        subClass = 'text-on-surface-variant/60 text-[10px]';
                      }

                      return (
                        <div
                          key={hour}
                          onClick={() => handleSlotClick(court.id, hour, !!booking)}
                          title={booking ? `${booking.customer_name} · ${fmtTime(booking.start_time)}–${fmtTime(booking.end_time)}` : selectable ? 'Click to select' : ''}
                          className={`flex flex-col items-center justify-center rounded-xl text-center w-[72px] py-3.5 px-1 border-2 transition-all duration-100 select-none ${cellClass}`}
                        >
                          <span className={`text-[12px] block leading-tight ${hourLabelClass}`}>
                            {fmtHour(hour)}
                          </span>
                          <span className={`mt-1 block truncate max-w-[64px] leading-tight ${subClass}`}>
                            {subText}
                          </span>
                          {booking && (
                            <span className={`text-[9px] mt-0.5 capitalize ${isWalkin ? 'text-amber-500' : 'text-[#00694c]/70'}`}>
                              {isWalkin ? 'walk-in' : booking.payment_method}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selection action bar */}
                {hasSelection && !isMaintenance && (
                  <div className="mx-5 mb-4 bg-primary/5 border border-primary/25 rounded-xl px-5 py-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm text-primary font-bold">
                        {sel.length} hour{sel.length !== 1 ? 's' : ''} selected
                      </span>
                      <span className="text-sm text-primary/70 ml-2">
                        {fmtTime(sel.sort()[0])} – {fmtTime(`${(toH(sel.sort()[sel.length - 1]) + 1).toString().padStart(2, '0')}:00`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCourtSelections(prev => ({ ...prev, [court.id]: [] }))}
                        className="text-xs text-on-surface-variant hover:text-on-surface underline px-2 py-1"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => openFormForCourt(court.id)}
                        className="bg-primary text-white text-xs font-bold px-5 py-2 rounded-lg shadow hover:opacity-90 transition-all"
                      >
                        Add walk-in →
                      </button>
                    </div>
                  </div>
                )}

                {/* Booking pills */}
                {bookings.length > 0 && (
                  <div className="px-5 pb-4 flex flex-wrap gap-2">
                    {bookings.map(b => (
                      <div key={b.booking_ref} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border ${
                        b.is_walkin ? 'bg-amber-50 border-amber-200' : 'bg-surface-container-low/50 border-outline-variant/40'
                      }`}>
                        {b.is_walkin && <span className="text-[10px] font-bold text-amber-700 uppercase">Walk-in</span>}
                        <span className="font-bold text-on-surface">{b.customer_name}</span>
                        <span className="text-on-surface-variant font-mono">{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                          b.payment_method === 'gcash' ? 'bg-[#EEEDFE] text-[#3C3489]' : 'bg-[#E6F1FB] text-[#0C447C]'
                        }`}>{b.payment_method}</span>
                        <span className="font-bold text-primary">₱{Number(b.total_amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-5 text-[11px] text-on-surface-variant">
          {[
            { color: 'bg-[#e8f5ee] border-[#9FE1CB]', label: 'Online booking' },
            { color: 'bg-amber-50 border-amber-300', label: 'Walk-in / current hour' },
            { color: 'bg-primary border-primary', label: 'Your selection' },
            { color: 'bg-white border-outline-variant/50', label: 'Open — click to select' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={`inline-block w-4 h-4 rounded border-2 ${l.color}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Walk-in form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white border border-outline-variant rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-surface-container px-6 py-5 border-b border-outline-variant flex justify-between items-center">
              <div>
                <h4 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  New walk-in booking
                </h4>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {courts.find(c => c.id === nbCourtId)?.name} · {fmtTime(nbStart)} – {fmtTime(nbEnd)}
                </p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4 text-sm">

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Customer name *</label>
                    <input required value={nbCustomer} onChange={e => setNbCustomer(e.target.value)}
                      placeholder="Juan Dela Cruz" autoFocus
                      className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:ring-0 bg-white" />
                  </div>
                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Phone *</label>
                    <input required value={nbPhone} onChange={e => setNbPhone(e.target.value)}
                      placeholder="09XX XXX XXXX"
                      className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-sm font-mono focus:border-primary focus:ring-0 bg-white" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Court</label>
                  <select value={nbCourtId} onChange={e => setNbCourtId(Number(e.target.value))}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:ring-0 bg-white">
                    {courts.filter(c => c.status === 'active').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Date</label>
                    <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)}
                      className="w-full border border-outline-variant rounded-lg px-2 py-2.5 text-sm focus:border-primary focus:ring-0 bg-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Start</label>
                    <input type="time" required value={nbStart} onChange={e => setNbStart(e.target.value)}
                      className="w-full border border-outline-variant rounded-lg px-2 py-2.5 text-sm focus:border-primary focus:ring-0 bg-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">End</label>
                    <input type="time" required value={nbEnd} onChange={e => setNbEnd(e.target.value)}
                      className="w-full border border-outline-variant rounded-lg px-2 py-2.5 text-sm focus:border-primary focus:ring-0 bg-white" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Amount (₱)</label>
                  <input type="number" required value={nbAmount} onChange={e => setNbAmount(Number(e.target.value))}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-sm font-mono font-bold focus:border-primary focus:ring-0 bg-white" />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Payment method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['cash', 'gcash'] as const).map(m => (
                      <button key={m} type="button" onClick={() => setNbPayment(m)}
                        className={`py-3 rounded-lg border text-sm font-bold uppercase tracking-wider transition-all ${
                          nbPayment === m
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-white text-on-surface-variant border-outline-variant hover:border-outline'
                        }`}>
                        {m === 'cash' ? '💵 Cash' : '📱 GCash'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-surface-container px-6 py-4 border-t border-outline-variant flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2 text-xs font-bold text-on-surface-variant uppercase tracking-wider hover:text-on-surface">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="bg-primary text-white font-bold text-xs uppercase tracking-wider px-8 py-2.5 rounded-lg shadow-sm disabled:opacity-60 hover:opacity-90 transition-all">
                  {submitting ? 'Saving…' : 'Confirm walk-in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
