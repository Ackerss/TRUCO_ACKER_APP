// Service Worker – Marcador Truco Acker

const CACHE_NAME = 'truco-acker-cache-v2.1'; // ← incrementado!
const urlsToCache = [
  '.',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        urlsToCache.map(url =>
          fetch(url, { cache: 'reload' }).then(resp => {
            if (!resp.ok) throw new Error(`Falha ao buscar ${url}`);
            return cache.put(url, resp);
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(resp => resp ||
      fetch(event.request).then(netResp => {
        if (netResp && netResp.status === 200 && netResp.type === 'basic') {
          const clone = netResp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return netResp;
      })
    )
  );
});
