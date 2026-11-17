const CACHE_NAME = 'science-saviour-v1.0.2'; // <-- Bump this version number on every update
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './sounds/rock.mp3',
  './sounds/phonk.mp3',
  './sounds/reggae.mp3',
  './sounds/viral.mp3',
  './sounds/jump.wav',
  './sounds/switch.wav',
  './sounds/flask.wav',
  './sounds/solo_1.wav',
  './sounds/solo_2.wav',
  './sounds/solo_3.wav',
  './sounds/solo_4.wav',
  './sounds/defeat_1.wav',
  './sounds/defeat_2.wav',
  './sounds/defeat_3.wav',
  './sounds/defeat_4.wav',
  './sounds/defeat_5.wav'
];

// Install event - cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old game caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('science-saviour-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clientsClaim();
});

// Fetch event - network-first for HTML, cache-first for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});