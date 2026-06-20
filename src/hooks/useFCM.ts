import { useEffect, useCallback, useState } from 'react';
import { messaging, VAPID_KEY, getToken, onMessage } from '../lib/firebase';
import { supabase } from '../lib/supabase';

export function useFCM(userEmail: string | null | undefined, role: 'user' | 'admin' | null) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Save token to DB
  const saveToken = useCallback(async () => {
    if (!messaging || !userEmail) return;
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
      if (!token) return;
      await supabase!.from('fcm_tokens').upsert(
        { email: userEmail, token, role },
        { onConflict: 'token' }
      );
    } catch (err) {
      console.error('[FCM] token error:', err);
    }
  }, [userEmail, role]);

  // Call this from a button click — Safari requires user gesture
  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') await saveToken();
  }, [saveToken]);

  // If already granted (e.g. returning user), save token silently
  useEffect(() => {
    if (permission === 'granted' && userEmail) saveToken();
  }, [permission, userEmail, saveToken]);

  // Foreground message handler
  useEffect(() => {
    if (!messaging) return;
    const unsub = onMessage(messaging, (payload) => {
      const { title, body } = payload.notification ?? {};
      if (Notification.permission === 'granted' && title) {
        new Notification(title, { body: body ?? '', icon: '/icon-192.png' });
      }
    });
    return () => unsub();
  }, []);

  return { permission, requestPushPermission };
}
