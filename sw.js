const CACHE_NAME = 'flashcards-v7.6'; // Increment version to trigger update

const BASE_PATH = self.registration && self.registration.scope 
  ? new URL(self.registration.scope).pathname.replace(/\/$/, '') 
  : '';

const RAW_ASSETS = [
  '/',
  '/index.html',
  '/pages/game.html',
  '/pages/generate.html',
  '/pages/stats.html',
  '/css/style.css',
  '/assets/fonts/fonts.css',
  '/assets/fonts/material-symbols-rounded.woff2',
  '/assets/fonts/roboto-flex.woff2',
  '/assets/vendor/material-web.bundle.js',
  '/js/index.js',
  '/js/game.js',
  '/js/engine/scheduler.js',
  '/js/engine/effects.js',
  '/js/engine/input-controller.js',
  '/js/engine/tutor.js',
  '/js/engine/pomodoro.js',
  '/js/generate.js',
  '/js/stats.js',
  '/js/stats-tracker.js',
  '/js/key-manager.js',
  '/js/ripple.js',
  '/js/utils.js',
  '/js/config.js',
  '/js/pdf-worker.js',
  '/manifest.json',
  '/favicon.png',
  '/assets/img/favicon.png',
  '/assets/img/logo.svg',
  '/assets/img/logo.png',
  '/assets/img/menu.svg',
  '/assets/img/stats.svg',
  '/assets/img/config_ai.svg',
  '/assets/img/enabled_ai.svg',
  '/assets/img/highlight.svg',
  '/assets/img/exit.svg',
  '/assets/img/open.svg',
  '/assets/img/open_double.svg',
  '/assets/img/fill.svg',
  '/assets/img/anki.svg',
  '/assets/img/multiple choice.svg',
  '/assets/img/comment.svg'
];

const ASSETS_TO_CACHE = RAW_ASSETS.map(p => p === '/' ? (BASE_PATH || '/') : `${BASE_PATH}${p}`);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE).catch(err => {
      console.warn('SW cache.addAll warning:', err);
    }))
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

const ALLOWED_CDN_HOSTS = new Set([
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net',
  'esm.run'
]);

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy: Network-first with no-cache for origin assets to always deliver fresh code
  if (ASSETS_TO_CACHE.includes(url.pathname) || url.origin === self.location.origin) {
    event.respondWith(fetch(event.request, { cache: 'no-cache' }));
    return;
  }

  // Strategy: Cache-First for whitelisted CDNs
  if (ALLOWED_CDN_HOSTS.has(url.hostname)) {
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