// ============================================================================
// Increment CACHE_VERSION whenever you deploy changes to GitHub Pages
// ============================================================================
const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `alchemix-cache-${CACHE_VERSION}`;

// Pre-cache essential runtime assets and CDN libraries
const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/@phosphor-icons/web'
];

// Install: Fetch & cache shell assets, activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS_TO_PRECACHE))
  );
  self.skipWaiting();
});

// Activate: Clean up previous obsolete caches and take control of open tabs
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== STATIC_CACHE) {
            return caches.delete(name);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch Strategy:
// 1. Navigation / HTML pages -> Network-First (forces fresh HTML deployments)
// 2. Static Assets & Scripts -> Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Navigation requests (HTML)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Other assets (fonts, images, scripts)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
