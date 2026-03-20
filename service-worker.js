const CACHE_NAME = 'jockeywhip-v1';
const PRECACHE = [
  '/jockeywhip/',
  '/jockeywhip/index.html',
  '/jockeywhip/style.css',
  '/jockeywhip/app.js',
  '/jockeywhip/manifest.json',
  '/jockeywhip/assets/jockey-icon.png',
  '/jockeywhip/assets/icon-192.png',
  '/jockeywhip/assets/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Navigation → network first, fallback to cached index
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/jockeywhip/index.html'))
    );
    return;
  }

  // Static assets → cache first
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      });
    })
  );
});
