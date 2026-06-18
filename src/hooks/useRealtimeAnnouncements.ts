import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  publish_at: string;
}

/**
 * Fetches active announcements and keeps them live via Realtime.
 * Returns [] immediately if Supabase is not configured.
 */
export function useRealtimeAnnouncements(): Announcement[] {
  const [items, setItems] = useState<Announcement[]>([]);

  const fetchAll = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, is_pinned, publish_at')
      .eq('is_active', true)
      .lte('publish_at', new Date().toISOString())
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('is_pinned', { ascending: false })
      .order('publish_at', { ascending: false });

    setItems(data ?? []);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    fetchAll();

    const channel = supabase
      .channel('announcements:active')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          const row = payload.new as Announcement & { is_active: boolean };
          if (row.is_active) {
            setItems((prev) =>
              row.is_pinned ? [row, ...prev] : [...prev, row]
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'announcements' },
        () => fetchAll() // simplest: refetch on any update
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'announcements' },
        (payload) => {
          setItems((prev) => prev.filter((a) => a.id !== (payload.old as any).id));
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [fetchAll]);

  return items;
}
