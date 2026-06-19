import { useEffect } from 'react';
import { messaging, VAPID_KEY, getToken, onMessage } from '../lib/firebase';
import { supabase } from '../lib/supabase';

export function useFCM(userEmail: string | null | undefined, role: 'user' | 'admin' | null) {
  useEffect(() => {
    if (!messaging || !userEmail || !role) return;

    const setup = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const token = await getToken(messaging!, { vapidKey: VAPID_KEY });
        if (!token) return;

        // Upsert token keyed by email — updates if same email logs in again
        await supabase!.from('fcm_tokens').upsert(
          { email: userEmail, token, role },
          { onConflict: 'email' }
        );
      } catch (err) {
        console.error('[FCM] setup error:', err);
      }
    };

    setup();

    // Foreground message handler — show a browser notification manually
    const unsub = onMessage(messaging!, (payload) => {
      const { title, body } = payload.notification ?? {};
      if (Notification.permission === 'granted' && title) {
        new Notification(title, { body: body ?? '', icon: '/favicon.ico' });
      }
    });

    return () => unsub();
  }, [userEmail, role]);
}
