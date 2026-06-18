import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

type BookingRow = Record<string, any>;

interface Options {
  /**
   * 'all'   — admin mode: receive every INSERT/UPDATE across all bookings
   * 'mine'  — customer mode: receive UPDATE for a specific booking_ref
   */
  mode: 'all' | 'mine';
  bookingRef?: string;
  onInsert?: (row: BookingRow) => void;
  onUpdate?: (row: BookingRow) => void;
  onDelete?: (row: BookingRow) => void;
}

/**
 * Subscribes to the bookings table via Supabase Realtime.
 *
 * Admin usage — live feed of all new/updated bookings:
 *   useRealtimeBookings({
 *     mode: 'all',
 *     onInsert: (row) => prependToList(row),
 *     onUpdate: (row) => replaceInList(row),
 *   });
 *
 * Customer usage — watch own booking status:
 *   useRealtimeBookings({
 *     mode: 'mine',
 *     bookingRef: 'SPC-88219',
 *     onUpdate: (row) => setStatus(row.booking_status),
 *   });
 */
export function useRealtimeBookings(options: Options) {
  const { mode, bookingRef, onInsert, onUpdate, onDelete } = options;
  const cbRef = useRef({ onInsert, onUpdate, onDelete });
  cbRef.current = { onInsert, onUpdate, onDelete };

  useEffect(() => {
    if (!supabase) return;

    const channelId =
      mode === 'mine' && bookingRef
        ? `bookings:mine:${bookingRef}`
        : 'bookings:all';

    // For 'mine' mode, filter server-side to only receive events for this ref.
    // For 'all' mode, receive everything (admins only — RLS handles access).
    const filter =
      mode === 'mine' && bookingRef
        ? `booking_ref=eq.${bookingRef}`
        : undefined;

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          ...(filter ? { filter } : {}),
        },
        (payload) => cbRef.current.onInsert?.(payload.new as BookingRow)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          ...(filter ? { filter } : {}),
        },
        (payload) => cbRef.current.onUpdate?.(payload.new as BookingRow)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bookings',
          ...(filter ? { filter } : {}),
        },
        (payload) => cbRef.current.onDelete?.(payload.old as BookingRow)
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [mode, bookingRef]);
}
