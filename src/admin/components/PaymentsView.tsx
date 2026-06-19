import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, ImageIcon, ExternalLink } from 'lucide-react';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import { notifyBookingConfirmed, notifyBookingDeclined } from '../../lib/notifications';

interface PaymentRow {
  id: number;
  bookingRef: string;
  courtName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  totalAmount: number;
  paymentReference: string | null;
  paymentScreenshotUrl: string | null;
  createdAt: string;
}

interface Props {
  toast: (type: 'success' | 'error' | 'warning', title: string, desc?: string) => void;
  onPaymentActioned: () => void;
}

function fmtTime(t: string) {
  const h = parseInt(t.split(':')[0]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${t.split(':')[1]} ${suffix}`;
}

export default function PaymentsView({ toast, onPaymentActioned }: Props) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [screenshotModal, setScreenshotModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseEnabled || !supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select('id, booking_ref, court_name, booking_date, start_time, end_time, customer_name, customer_phone, customer_email, total_amount, payment_reference, payment_screenshot_url, created_at')
      .eq('payment_status', 'pending_verification')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { console.error('[PaymentsView]', error); return; }
    setPayments((data ?? []).map((r: any) => ({
      id: r.id,
      bookingRef: r.booking_ref,
      courtName: r.court_name,
      bookingDate: r.booking_date,
      startTime: r.start_time,
      endTime: r.end_time,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      customerEmail: r.customer_email,
      totalAmount: Number(r.total_amount),
      paymentReference: r.payment_reference,
      paymentScreenshotUrl: r.payment_screenshot_url,
      createdAt: r.created_at,
    })));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: reload when any booking is inserted or updated
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    const channel = supabase
      .channel('payments-view')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings' }, () => load())
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, [load]);

  const handleApprove = async (p: PaymentRow) => {
    if (!isSupabaseEnabled || !supabase) return;
    setActing(p.bookingRef);
    const { error } = await supabase
      .from('bookings')
      .update({ booking_status: 'confirmed', payment_status: 'paid' })
      .eq('booking_ref', p.bookingRef);
    setActing(null);
    if (error) { toast('error', 'Failed to approve', error.message); return; }
    toast('success', 'Payment approved', `${p.customerName} — ${p.courtName} confirmed.`);
    notifyBookingConfirmed({
      bookingRef: p.bookingRef, courtName: p.courtName,
      customerEmail: p.customerEmail ?? '', customerName: p.customerName,
      date: p.bookingDate, startTime: p.startTime, endTime: p.endTime,
    });
    setPayments(prev => prev.filter(x => x.bookingRef !== p.bookingRef));
    onPaymentActioned();
  };

  const handleDecline = async (p: PaymentRow) => {
    if (!isSupabaseEnabled || !supabase) return;
    setActing(p.bookingRef);
    // Cancel booking + delete slots so time opens back up
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('bookings').update({ booking_status: 'cancelled', payment_status: 'failed' }).eq('booking_ref', p.bookingRef),
      supabase.from('booking_slots').delete().eq('booking_id', p.id),
    ]);
    setActing(null);
    if (e1 || e2) { toast('error', 'Failed to decline', (e1 ?? e2)?.message); return; }
    toast('warning', 'Payment declined', `${p.customerName}'s booking has been cancelled.`);
    notifyBookingDeclined({
      bookingRef: p.bookingRef, courtName: p.courtName,
      customerEmail: p.customerEmail ?? '', customerName: p.customerName,
      date: p.bookingDate, startTime: p.startTime, endTime: p.endTime,
    });
    setPayments(prev => prev.filter(x => x.bookingRef !== p.bookingRef));
    onPaymentActioned();
  };

  const getScreenshotUrl = async (path: string) => {
    if (!supabase) return null;
    const { data } = await supabase.storage.from('payment-screenshots').createSignedUrl(path, 60);
    return data?.signedUrl ?? null;
  };

  const openScreenshot = async (rawUrl: string) => {
    // rawUrl could be a storage path or a full signed URL
    if (rawUrl.startsWith('http')) { setScreenshotModal(rawUrl); return; }
    const url = await getScreenshotUrl(rawUrl);
    if (url) setScreenshotModal(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">Pending Payments</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Review and approve or decline customer payment submissions.</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg border border-outline-variant hover:bg-surface-container-low transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="text-sm text-on-surface-variant animate-pulse">Loading pending payments…</div>
      )}

      {!loading && payments.length === 0 && (
        <div className="bg-white border border-outline-variant/40 rounded-xl p-12 text-center shadow-sm">
          <CheckCircle className="w-10 h-10 text-primary mx-auto mb-3 opacity-40" />
          <p className="font-bold text-on-surface">All clear!</p>
          <p className="text-sm text-on-surface-variant mt-1">No pending payments to review.</p>
        </div>
      )}

      <div className="space-y-3">
        {payments.map(p => {
          const isActing = acting === p.bookingRef;
          const d = new Date(p.bookingDate + 'T00:00:00');
          const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          return (
            <div key={p.bookingRef} className="bg-white border border-outline-variant/40 rounded-xl shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between px-5 py-4 gap-3">
                {/* Booking info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-on-surface">{p.customerName}</span>
                    <span className="text-[10px] font-mono text-on-surface-variant">{p.customerPhone}</span>
                    {p.customerEmail && <span className="text-[10px] text-on-surface-variant truncate">{p.customerEmail}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
                    <span className="font-semibold text-on-surface">{p.courtName}</span>
                    <span>·</span>
                    <span>{dateLabel}</span>
                    <span>·</span>
                    <span>{fmtTime(p.startTime)} – {fmtTime(p.endTime)}</span>
                    <span>·</span>
                    <span className="font-bold text-primary">₱{p.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {p.paymentReference ? (
                      <span className="flex items-center gap-1.5 text-xs bg-surface-container px-2.5 py-1 rounded-full border border-outline-variant/50">
                        <span className="text-[10px] font-bold uppercase text-on-surface-variant">Ref</span>
                        <span className="font-mono font-bold text-on-surface">{p.paymentReference}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-on-surface-variant/50 italic">No reference number</span>
                    )}
                    {p.paymentScreenshotUrl ? (
                      <button onClick={() => openScreenshot(p.paymentScreenshotUrl!)} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold">
                        <ImageIcon className="w-3.5 h-3.5" />View screenshot<ExternalLink className="w-3 h-3 opacity-50" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-on-surface-variant/50 italic">No screenshot</span>
                    )}
                    <span className="text-[10px] font-mono text-on-surface-variant/40">{p.bookingRef}</span>
                  </div>
                </div>

                {/* Action buttons — full width on mobile, inline on sm+ */}
                <div className="flex items-center gap-2 sm:shrink-0 sm:flex-col sm:items-end">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                  <div className="flex items-center gap-2 flex-1 sm:flex-none">
                    <button
                      disabled={isActing}
                      onClick={() => handleDecline(p)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />Decline
                    </button>
                    <button
                      disabled={isActing}
                      onClick={() => handleApprove(p)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-primary text-white hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
                    >
                      {isActing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Screenshot modal */}
      {screenshotModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4"
          onClick={() => setScreenshotModal(null)}
        >
          <div className="max-w-lg w-full bg-white rounded-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
              <span className="font-bold text-sm text-on-surface">Payment Screenshot</span>
              <button onClick={() => setScreenshotModal(null)} className="text-on-surface-variant hover:text-on-surface text-lg leading-none">✕</button>
            </div>
            <img src={screenshotModal} alt="Payment proof" className="w-full object-contain max-h-[70vh]" />
          </div>
        </div>
      )}
    </div>
  );
}
