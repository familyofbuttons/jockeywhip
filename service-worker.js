/* Simple, robust service worker for Jockey Whip Races
   - Cache static assets on install
   - Serve cached assets first, fall back to network for navigation
   - Update lifecycle: skipWaiting on new SW, clients.claim on activate
   - Responds to 'skipWaiting' message to allow immediate activation
*/

const CACHE_NAME = 'jockey-whip-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/assets/jockey-icon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => {
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
      await self.clients.claim();
    })()
  );
});

// Fetch: cache-first for static assets, network-first for navigation requests
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // For navigation requests (HTML), try network first then fallback to cache
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Put a copy in cache for offline use
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For other requests (assets), use cache-first strategy
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(networkResponse => {
        // Cache fetched asset for future
        return caches.open(CACHE_NAME).then(cache => {
          // Avoid caching opaque responses (cross-origin) unless needed
          try { cache.put(request, networkResponse.clone()); } catch (e) {}
          return networkResponse;
        });
      }).catch(() => {
        // If asset not in cache and network fails, try fallback icons or index
        if (request.destination === 'image') {
          return caches.match('/assets/icon-192.png');
        }
        return caches.match('/index.html');
      });
    })
  );
});

// Listen for messages from the page (e.g., to skipWaiting)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
