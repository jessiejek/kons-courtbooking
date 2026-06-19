import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyB9_qaDUBRBCodkZkDEk3FpQ0WG2RFSKW0',
  authDomain: 'kons-courtbooking.firebaseapp.com',
  projectId: 'kons-courtbooking',
  storageBucket: 'kons-courtbooking.firebasestorage.app',
  messagingSenderId: '195776457373',
  appId: '1:195776457373:web:804eb8a33527676562c274',
  measurementId: 'G-KWNGLVH4ZG',
};

const VAPID_KEY = 'BMHgTvxVfJZyzCUlKfaDK2qWgMmizSx2M61lTCiKq4AAkePW9e1f-ya1465ggVDfqYgDkRyA1IBdpUt0-FZyXGQ';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messaging: Messaging | null = null;
try {
  messaging = getMessaging(app);
} catch {
  // Not supported (e.g. SSR or browser without service worker support)
}

export { messaging, VAPID_KEY };
export { getToken, onMessage };
