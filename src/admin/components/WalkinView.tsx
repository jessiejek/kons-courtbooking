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

export default function WalkinView({ courts, onWalkinCreated, toast }: WalkinViewProps) {
  const today = new Date().toISOString().split('T')[0];
  const [viewDate, setViewDate] = useState(today);
  const [allBookings, setAllBookings] = useState<(SlotBooking & { court_id: number })[]>([]);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [preselectedCourtId, setPreselectedCourtId] = useState<number | null>(null);
  const [nbCustomer, setNbCustomer] = useState('');
  const [nbPhone, setNbPhone] = useState('');
  const [nbCourtId, setNbCourtId] = useState<number>(courts[0]?.id ?? 1);
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
  };

  const getCourtBookings = (courtId: number) =>
    allBookings.filter(b => b.court_id === courtId);

  const getSlotState = (bookings: (SlotBooking & { court_id: number })[], hour: string) => {
    const h = parseInt(hour.split(':')[0]);
    const nowH = new Date().getHours();
    const isCurrentHour = h === nowH && viewDate === today;
    const booking = bookings.find(b => {
      const start = parseInt(b.start_time.split(':')[0]);
      const end = parseInt(b.end_time.split(':')[0]);
      return h >= start && h < end;
    });
    return { booking, isCurrentHour };
  };

  const activeCourts = courts.filter(c => c.status !== 'inactive');
  const totalBookings = allBookings.length;
  const walkinCount = allBookings.filter(b => b.is_walkin).length;
  const occupiedNow = activeCourts.filter(c => {
    const nowH = new Date().getHours();
    return getCourtBookings(c.id).some(b => {
      const start = parseInt(b.start_time.split(':')[0]);
      const end = parseInt(b.end_time.split(':')[0]);
      return nowH >= start && nowH < end;
    });
  }).length;
  const totalRevenue = allBookings.reduce((s, b) => s + Number(b.total_amount), 0);

  const openForm = (courtId?: number) => {
    const cid = courtId ?? courts.find(c => c.status === 'active')?.id ?? courts[0]?.id ?? 1;
    setNbCourtId(cid);
    setPreselectedCourtId(courtId ?? null);
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
    setNbCustomer(''); setNbPhone(''); setNbStart('09:00'); setNbEnd('10:00'); setNbAmount(300); setNbPayment('cash');
    setShowForm(false);
    await loadSchedule();
    onWalkinCreated();
  };

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">Walk-in counter</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Register walk-in guests and view court occupancy for any day.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={viewDate}
            onChange={e => setViewDate(e.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium bg-surface focus:border-primary focus:ring-0"
          />
          <button onClick={() => openForm()} className="flex items-center gap-2 bg-primary text-white font-bold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-all shadow-sm">
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
          <div key={s.label} className="bg-surface-container-low/50 border border-outline-variant/40 rounded-xl p-4">
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

        <div className="space-y-3">
          {activeCourts.map(court => {
            const bookings = getCourtBookings(court.id);
            const isMaintenance = court.status === 'maintenance';
            const nowH = new Date().getHours();
            const isOccupiedNow = bookings.some(b => {
              const start = parseInt(b.start_time.split(':')[0]);
              const end = parseInt(b.end_time.split(':')[0]);
              return nowH >= start && nowH < end && viewDate === today;
            });

            return (
              <div key={court.id} className={`bg-surface border border-outline-variant/60 rounded-xl overflow-hidden shadow-sm ${isMaintenance ? 'opacity-50' : ''}`}>

                {/* Court header row */}
                <div className="flex items-center justify-between px-5 py-3 bg-surface-container-low/40 border-b border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-black text-[11px]">{court.id}</span>
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
                    {!isMaintenance && (
                      <button
                        onClick={() => openForm(court.id)}
                        className="text-[11px] font-bold text-primary border border-primary/30 hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-all"
                      >
                        + Add walk-in
                      </button>
                    )}
                  </div>
                </div>

                {/* Hour strip */}
                <div className="px-5 py-3 overflow-x-auto">
                  <div className="flex gap-1.5 min-w-max">
                    {HOURS.map(hour => {
                      const { booking, isCurrentHour } = getSlotState(bookings, hour);
                      const isWalkin = booking?.is_walkin;
                      return (
                        <div
                          key={hour}
                          className={`flex flex-col items-center justify-center rounded-lg text-center min-w-[56px] py-2 px-1 border transition-all ${
                            booking
                              ? isWalkin
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-[#e8f5ee] border-[#9FE1CB]'
                              : isCurrentHour
                              ? 'bg-amber-50 border-amber-200'
                              : 'bg-surface-container-low/30 border-outline-variant/30'
                          }`}
                        >
                          <span className={`text-[9px] font-bold block ${
                            isCurrentHour && !booking ? 'text-amber-600' : 'text-on-surface-variant'
                          }`}>
                            {fmtHour(hour)}
                            {isCurrentHour && !booking && ' ●'}
                          </span>
                          {booking ? (
                            <>
                              <span className={`text-[9px] font-bold mt-0.5 block truncate max-w-[48px] ${isWalkin ? 'text-amber-700' : 'text-[#005a40]'}`}>
                                {booking.customer_name.split(' ')[0]}
                              </span>
                              <span className={`text-[8px] font-mono capitalize ${isWalkin ? 'text-amber-600' : 'text-[#3d4943]'}`}>
                                {isWalkin ? 'walk-in' : booking.payment_method}
                              </span>
                            </>
                          ) : (
                            <span className="text-[9px] text-on-surface-variant mt-0.5">
                              {isCurrentHour ? 'now' : 'open'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Booking pills */}
                {bookings.length > 0 && (
                  <div className="px-5 pb-3 flex flex-wrap gap-2">
                    {bookings.map(b => (
                      <div
                        key={b.booking_ref}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border ${
                          b.is_walkin
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-surface-container-low/50 border-outline-variant/40'
                        }`}
                      >
                        {b.is_walkin && <span className="text-[10px] font-bold text-amber-700 uppercase">Walk-in</span>}
                        <span className="font-bold text-on-surface">{b.customer_name}</span>
                        <span className="text-on-surface-variant font-mono">{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                          b.payment_method === 'gcash'
                            ? 'bg-[#EEEDFE] text-[#3C3489]'
                            : 'bg-[#E6F1FB] text-[#0C447C]'
                        }`}>
                          {b.payment_method}
                        </span>
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
        <div className="mt-4 flex gap-5 text-[11px] text-on-surface-variant">
          {[
            { color: 'bg-[#e8f5ee] border-[#9FE1CB]', label: 'Online booking' },
            { color: 'bg-amber-50 border-amber-200', label: 'Walk-in / current hour' },
            { color: 'bg-surface-container-low/30 border-outline-variant/30', label: 'Open' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded border ${l.color}`} />
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
                <p className="text-xs text-on-surface-variant mt-0.5">Payment collected at desk — marked as paid immediately.</p>
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
                      placeholder="Juan Dela Cruz"
                      className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-0 bg-white" />
                  </div>
                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Phone *</label>
                    <input required value={nbPhone} onChange={e => setNbPhone(e.target.value)}
                      placeholder="09XX XXX XXXX"
                      className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm font-mono focus:border-primary focus:ring-0 bg-white" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Court</label>
                  <select value={nbCourtId} onChange={e => setNbCourtId(Number(e.target.value))}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-0 bg-white">
                    {courts.filter(c => c.status === 'active').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Date</label>
                    <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)}
                      className="w-full border border-outline-variant rounded-lg px-2 py-2 text-sm focus:border-primary focus:ring-0 bg-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Start</label>
                    <input type="time" required value={nbStart} onChange={e => setNbStart(e.target.value)}
                      className="w-full border border-outline-variant rounded-lg px-2 py-2 text-sm focus:border-primary focus:ring-0 bg-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">End</label>
                    <input type="time" required value={nbEnd} onChange={e => setNbEnd(e.target.value)}
                      className="w-full border border-outline-variant rounded-lg px-2 py-2 text-sm focus:border-primary focus:ring-0 bg-white" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Amount (₱)</label>
                  <input type="number" required value={nbAmount} onChange={e => setNbAmount(Number(e.target.value))}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm font-mono font-bold focus:border-primary focus:ring-0 bg-white" />
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
