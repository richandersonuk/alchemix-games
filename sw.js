const CACHE_NAME = 'alchemix-arcade-v10';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/science-saviour/cartridge.svg',
  '/chem-tycoon/cartridge.svg',
  '/econfigs/cartridge.svg',
  '/QAD/cartridge.svg',
  '/redox-rogue/cartridge.svg',
  '/subatomic-sorter/cartridge.svg',
  '/lattice-lock/cartridge.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass service worker cache for Godot heavy binaries to prevent memory saturation
  if (url.pathname.endsWith('.wasm') || url.pathname.endsWith('.pck')) {
    return;
  }

  // Never cache live scoreboard data (global leaderboards must always be fresh)
  if (url.hostname.endsWith('.workers.dev') || url.pathname.startsWith('/api/')) {
    return;
  }

  // Bypass for streamed media: <audio> uses HTTP Range requests, which the
  // cache can't answer correctly (Safari/iOS then refuses to play the track)
  if (event.request.headers.has('range') || /\.(mp3|m4a|ogg|opus|wav|mp4|webm)$/i.test(url.pathname)) {
    return;
  }

  // Network-first for HTML / navigation requests so Hub updates & back-to-hub links are always fresh
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Stale-while-revalidate for static assets (SVGs, icons, manifest)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cachedResponse);
      return cachedResponse || networkFetch;
    })
  );
});