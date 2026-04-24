const CACHE_NAME = 'flashcards-v2.2'; // Increment version to trigger update
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/pages/game.html',
  '/pages/generate.html',
  '/css/style.css',
  '/js/index.js',
  '/js/game.js',
  '/js/generate.js',
  '/js/utils.js',
  '/js/config.js',
  '/js/pdf-worker.js',
  '/manifest.json',
  '/assets/img/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy: Stale-While-Revalidate for local assets
  if (ASSETS_TO_CACHE.includes(url.pathname) || url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cached) => {
          const fetched = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          return cached || fetched;
        });
      })
    );
    return;
  }

  // Strategy: Cache-First for CDNs
  if (url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('cdn.tailwindcss.com')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // Default: Network-only
  event.respondWith(fetch(event.request));
});