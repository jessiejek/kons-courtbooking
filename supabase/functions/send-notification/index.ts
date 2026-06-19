import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL')!;
const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY')!.replace(/\\n/g, '\n');
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID')!;

// Build a signed JWT and exchange it for a Google OAuth2 access token
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header  = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({
    iss:   FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));

  const signingInput = `${header}.${payload}`;

  const pem = FIREBASE_PRIVATE_KEY
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pem), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const jwt = `${signingInput}.${toBase64UrlBytes(new Uint8Array(sig))}`;

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

function toBase64Url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function toBase64UrlBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Send FCM notification to a single token
async function sendFCM(token: string, title: string, body: string, url: string) {
  const accessToken = await getAccessToken();
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          webpush: {
            notification: { icon: '/favicon.ico' },
            fcm_options: { link: url },
          },
        },
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`FCM error: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { event, booking } = await req.json();
    // event: 'payment_submitted' | 'booking_confirmed' | 'booking_declined'
    // booking: { id, bookingRef, courtName, customerEmail, customerName, date, startTime, endTime }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (event === 'payment_submitted') {
      // Notify all admins
      const { data: admins } = await supabase
        .from('fcm_tokens')
        .select('token')
        .eq('role', 'admin');

      await Promise.allSettled(
        (admins ?? []).map(a =>
          sendFCM(
            a.token,
            '💳 New Payment Submitted',
            `${booking.customerName} submitted payment for ${booking.courtName} on ${booking.date}`,
            'https://courtbooking-sooty.vercel.app/admin/payments',
          )
        )
      );

    } else if (event === 'booking_confirmed') {
      const { data: row } = await supabase
        .from('fcm_tokens')
        .select('token')
        .eq('email', booking.customerEmail)
        .single();

      if (row?.token) {
        await sendFCM(
          row.token,
          '✅ Booking Confirmed!',
          `Your booking for ${booking.courtName} on ${booking.date} at ${booking.startTime} is confirmed.`,
          'https://courtbooking-sooty.vercel.app/bookings',
        );
      }

    } else if (event === 'booking_declined') {
      const { data: row } = await supabase
        .from('fcm_tokens')
        .select('token')
        .eq('email', booking.customerEmail)
        .single();

      if (row?.token) {
        await sendFCM(
          row.token,
          '❌ Booking Declined',
          `Your booking for ${booking.courtName} on ${booking.date} could not be confirmed. Please contact us.`,
          'https://courtbooking-sooty.vercel.app/bookings',
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    console.error('[send-notification]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
