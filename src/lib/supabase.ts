import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Single shared Supabase client.
 * Falls back gracefully when env vars are missing so the app still
 * runs in demo/localStorage mode without a real Supabase project.
 */
export const supabase = url && key
  ? createClient(url, key, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

export const isSupabaseEnabled = !!supabase;
