// Minimal fetch handler — required for PWA installability
self.addEventListener('fetch', () => {});

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB9_qaDUBRBCodkZkDEk3FpQ0WG2RFSKW0',
  authDomain: 'kons-courtbooking.firebaseapp.com',
  projectId: 'kons-courtbooking',
  storageBucket: 'kons-courtbooking.firebasestorage.app',
  messagingSenderId: '195776457373',
  appId: '1:195776457373:web:804eb8a33527676562c274',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'Kons Court Booking', {
    body: body ?? '',
    icon: icon ?? '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
  });
});

// Click on notification → open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
