import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribes to booking_slots for a specific court + date.
 * Returns a Set of booked slot times (e.g. {"09:00", "10:00"}).
 *
 * When Supabase is not configured the hook returns an empty Set
 * so the app continues working in demo/localStorage mode.
 *
 * Usage:
 *   const bookedSlots = useRealtimeSlots('court-1', '2026-10-13');
 *   const isBooked = bookedSlots.has('09:00');
 */
export function useRealtimeSlots(courtSlug: string, date: string): Set<string> {
  const [bookedTimes, setBookedTimes] = useState<Set<string>>(new Set());

  // Convert "HH:MM:SS" (postgres time) → "HH:MM"
  const normalize = (t: string) => t.slice(0, 5);

  const fetchInitial = useCallback(async () => {
    if (!supabase) return;

    // Booked slots
    const { data: booked } = await supabase
      .from('booking_slots')
      .select('slot_time, courts!inner(slug)')
      .eq('courts.slug', courtSlug)
      .eq('slot_date', date);

    // Active holds (not expired) for this court+date
    const { data: courtRow } = await supabase
      .from('courts').select('id').eq('slug', courtSlug).single();

    const { data: holds } = courtRow ? await supabase
      .from('slot_holds')
      .select('slot_time')
      .eq('court_id', courtRow.id)
      .eq('slot_date', date)
      .gt('expires_at', new Date().toISOString()) : { data: [] };

    const times = new Set<string>([
      ...(booked ?? []).map((r: any) => normalize(r.slot_time)),
      ...(holds ?? []).map((r: any) => normalize(r.slot_time)),
    ]);
    setBookedTimes(times);
  }, [courtSlug, date]);

  useEffect(() => {
    if (!supabase) return;

    fetchInitial();

    // Subscribe to INSERT and DELETE on booking_slots.
    // Filter by slot_date so we only receive events for the selected day.
    const channel = supabase
      .channel(`slots:${courtSlug}:${date}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_slots',
          filter: `slot_date=eq.${date}`,
        },
        async (payload) => {
          // Verify the slot belongs to our court (payload doesn't include joined columns)
          const newSlot = payload.new as { court_id: number; slot_time: string };
          const { data } = await supabase!
            .from('courts')
            .select('slug')
            .eq('id', newSlot.court_id)
            .single();

          if (data?.slug === courtSlug) {
            setBookedTimes((prev) => new Set([...prev, normalize(newSlot.slot_time)]));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'booking_slots',
          filter: `slot_date=eq.${date}`,
        },
        (payload) => {
          const deleted = payload.old as { slot_time: string };
          setBookedTimes((prev) => {
            const next = new Set(prev);
            next.delete(normalize(deleted.slot_time));
            return next;
          });
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'slot_holds', filter: `slot_date=eq.${date}` },
        async (payload) => {
          const row = payload.new as { court_id: number; slot_time: string };
          const { data } = await supabase!.from('courts').select('slug').eq('id', row.court_id).single();
          if (data?.slug === courtSlug) setBookedTimes(prev => new Set([...prev, normalize(row.slot_time)]));
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'slot_holds', filter: `slot_date=eq.${date}` },
        (payload) => {
          const row = payload.old as { slot_time: string };
          // Refetch to recalculate — a deleted hold might still have a real booking
          fetchInitial();
        }
      )
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [courtSlug, date, fetchInitial]);

  return bookedTimes;
}
