/**
 * BookingReceiptPDF
 * A hidden, off-screen div styled as a branded receipt.
 * html2canvas captures it; jsPDF embeds it as a downloadable PDF.
 * Width is fixed at 600px so the capture is crisp regardless of viewport.
 */
import React from 'react';
import { Booking } from '../types';

interface Props {
  booking: Booking;
  divRef: React.RefObject<HTMLDivElement | null>;
}

const BRAND_GREEN = '#00694c';
const BRAND_LIGHT = '#e8f5f0';

function fmt12(t: string) {
  const [h, m] = t.split(':');
  const hv = parseInt(h);
  const suffix = hv >= 12 ? 'PM' : 'AM';
  const dh = hv % 12 === 0 ? 12 : hv % 12;
  return `${dh}:${m} ${suffix}`;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function BookingReceiptPDF({ booking, divRef }: Props) {
  const timeRange = `${fmt12(booking.startTime)} – ${fmt12(booking.endTime)}`;
  const dateLabel = fmtDate(booking.date);
  const issuedAt = new Date().toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  return (
    <div
      ref={divRef}
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: '600px',
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        background: '#ffffff',
        color: '#0f172a',
      }}
    >
      {/* ── Header band ── */}
      <div style={{
        background: BRAND_GREEN,
        padding: '32px 40px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            {/* Logo mark */}
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'rgba(255,255,255,0.15)',
              border: '1.5px solid rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>S</span>
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: 0.5 }}>
                Sunshine Pickleball Courts
              </div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 }}>
                Bonifacio Global City, Taguig
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5 }}>Booking Receipt</div>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, letterSpacing: 1, marginTop: 2 }}>
            #{booking.id}
          </div>
        </div>
      </div>

      {/* ── Status ribbon ── */}
      <div style={{
        background: BRAND_LIGHT,
        borderBottom: `1px solid #c6e8db`,
        padding: '10px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: BRAND_GREEN,
          }} />
          <span style={{ color: BRAND_GREEN, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            Payment Confirmed
          </span>
        </div>
        <span style={{ color: '#64748b', fontSize: 10 }}>Issued: {issuedAt}</span>
      </div>

      {/* ── Main body ── */}
      <div style={{ padding: '32px 40px' }}>

        {/* Court + schedule block */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 24,
        }}>
          {/* Court name header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, color: '#94a3b8', marginBottom: 4 }}>
                Court Facility
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                {booking.courtName}
              </div>
            </div>
            <div style={{
              background: BRAND_GREEN,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: 20,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              Upcoming
            </div>
          </div>

          {/* Date + Time row */}
          <div style={{ display: 'flex', padding: '16px 20px', gap: 0 }}>
            <div style={{ flex: 1, paddingRight: 20, borderRight: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, color: '#94a3b8', marginBottom: 6 }}>
                Schedule Date
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{dateLabel}</div>
            </div>
            <div style={{ flex: 1, paddingLeft: 20 }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, color: '#94a3b8', marginBottom: 6 }}>
                Block Time
              </div>
              <div style={{
                display: 'inline-block',
                background: BRAND_LIGHT,
                color: BRAND_GREEN,
                fontWeight: 800,
                fontSize: 14,
                padding: '3px 10px',
                borderRadius: 6,
              }}>
                {timeRange}
              </div>
            </div>
          </div>
        </div>

        {/* Guest + Payment row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{
            flex: 1,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '16px 20px',
          }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, color: '#94a3b8', marginBottom: 6 }}>
              Reserved For
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{booking.fullName}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{booking.phoneNumber}</div>
          </div>

          <div style={{
            flex: 1,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '16px 20px',
          }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, color: '#94a3b8', marginBottom: 6 }}>
              Payment
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
              {booking.paymentMethod}
              {booking.cardEnding ? ` ···· ${booking.cardEnding}` : ''}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Fully Paid</div>
          </div>
        </div>

        {/* Total amount block */}
        <div style={{
          background: BRAND_GREEN,
          borderRadius: 12,
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
              Total Amount Paid
            </div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 28 }}>
              ₱{booking.price}.00
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Booking ID</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 1, marginTop: 2 }}>#{booking.id}</div>
          </div>
        </div>

        {/* Location */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          marginBottom: 24,
          padding: '14px 20px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: BRAND_LIGHT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: 1,
          }}>
            {/* pin icon via unicode */}
            <span style={{ color: BRAND_GREEN, fontSize: 14 }}>📍</span>
          </div>
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, color: '#94a3b8', marginBottom: 4 }}>
              Facility Location
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
              Sunshine Hills Country Club — Main Court
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              7th Ave &amp; 30th St, Bonifacio Global City, Taguig, Metro Manila
            </div>
          </div>
        </div>

        {/* Staff verification strip */}
        <div style={{
          border: `1.5px dashed ${BRAND_GREEN}`,
          borderRadius: 10,
          padding: '14px 20px',
          textAlign: 'center',
          background: BRAND_LIGHT,
        }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 2, color: BRAND_GREEN, fontWeight: 700, marginBottom: 4 }}>
            ✦ Staff Verification
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
            Present this receipt at the front desk for gate entry
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
            Valid only for the schedule and court listed above. Non-transferable.
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: '1px solid #e2e8f0',
        padding: '16px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f8fafc',
      }}>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          © 2026 Sunshine Pickleball Courts. All rights reserved.
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          sunshine-pickleball.ph
        </div>
      </div>
    </div>
  );
}
