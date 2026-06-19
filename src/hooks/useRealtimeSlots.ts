import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type SlotStatus = 'booked' | 'pending' | 'hold';

export function useRealtimeSlots(courtSlug: string, date: string): Map<string, SlotStatus> {
  const [slotMap, setSlotMap] = useState<Map<string, SlotStatus>>(new Map());

  const normalize = (t: string) => t.slice(0, 5);

  const fetchInitial = useCallback(async () => {
    if (!supabase) return;

    // Fetch booking_slots joined with booking status
    const { data: booked } = await supabase
      .from('booking_slots')
      .select('slot_time, bookings!inner(booking_status), courts!inner(slug)')
      .eq('courts.slug', courtSlug)
      .eq('slot_date', date);

    const { data: courtRow } = await supabase
      .from('courts').select('id').eq('slug', courtSlug).single();

    const { data: holds } = courtRow ? await supabase
      .from('slot_holds')
      .select('slot_time')
      .eq('court_id', courtRow.id)
      .eq('slot_date', date)
      .gt('expires_at', new Date().toISOString()) : { data: [] };

    const map = new Map<string, SlotStatus>();
    (holds ?? []).forEach((r: any) => map.set(normalize(r.slot_time), 'hold'));
    (booked ?? []).forEach((r: any) => {
      const status: SlotStatus = r.bookings?.booking_status === 'pending' ? 'pending' : 'booked';
      map.set(normalize(r.slot_time), status);
    });
    setSlotMap(map);
  }, [courtSlug, date]);

  useEffect(() => {
    if (!supabase) return;
    fetchInitial();

    const channel = supabase
      .channel(`slots:${courtSlug}:${date}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'booking_slots', filter: `slot_date=eq.${date}` },
        async (payload) => {
          const newSlot = payload.new as { court_id: number; slot_time: string };
          const { data } = await supabase!.from('courts').select('slug').eq('id', newSlot.court_id).single();
          if (data?.slug === courtSlug) fetchInitial();
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'booking_slots', filter: `slot_date=eq.${date}` },
        () => fetchInitial()
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'slot_holds', filter: `slot_date=eq.${date}` },
        async (payload) => {
          const row = payload.new as { court_id: number; slot_time: string };
          const { data } = await supabase!.from('courts').select('slug').eq('id', row.court_id).single();
          if (data?.slug === courtSlug) setSlotMap(prev => new Map([...prev, [normalize(row.slot_time), 'hold']]));
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'slot_holds', filter: `slot_date=eq.${date}` },
        () => fetchInitial()
      )
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [courtSlug, date, fetchInitial]);

  return slotMap;
}
