import { supabase } from './supabase';

const EDGE_URL = 'https://hwwwhdtqdzlizhfqcdow.supabase.co/functions/v1/send-notification';

interface BookingInfo {
  bookingRef: string;
  courtName: string;
  customerEmail: string;
  customerName: string;
  date: string;
  startTime: string;
  endTime: string;
}

async function callEdge(event: string, booking: BookingInfo) {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ event, booking }),
  }).catch(err => console.warn('[notify]', err));
}

export const notifyPaymentSubmitted = (booking: BookingInfo) =>
  callEdge('payment_submitted', booking);

export const notifyBookingConfirmed = (booking: BookingInfo) =>
  callEdge('booking_confirmed', booking);

export const notifyBookingDeclined = (booking: BookingInfo) =>
  callEdge('booking_declined', booking);
