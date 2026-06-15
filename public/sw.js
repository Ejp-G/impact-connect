// Impact Connect — Service Worker v1.0
const CACHE_NAME = 'impact-connect-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Gestion des notifications push
self.addEventListener('push', e => {
  if (!e.data) return;
  
  let data = {};
  try { data = e.data.json(); } 
  catch { data = { title: 'Impact Connect', body: e.data.text() }; }

  const options = {
    body:    data.body    || 'Nouvelle notification',
    icon:    data.icon    || '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    tag:     data.tag     || 'impact-notif',
    data:    { url: data.url || '/' },
    actions: data.actions || [],
    vibrate: [200, 100, 200],
    requireInteraction: data.urgent || false,
  };

  e.waitUntil(
    self.registration.showNotification(data.title || 'Impact Connect', options)
  );
});

// Clic sur notification — ouvre la bonne page
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
