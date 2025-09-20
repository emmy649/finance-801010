const CACHE = 'emi-finance-cache-v2';
const APP_SHELL = [
  'index.html',
  'manifest.json',
];

// install: кеширай shell-а
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// activate: чисти стари кешове
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// fetch: cache-first за всичко статично; network → cache за останалото
self.addEventListener('fetch', (e) => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return resp;
      }).catch(async () => {
        // офлайн fallback към index.html (SPA)
        const idx = await caches.match('index.html');
        return idx || Response.error();
      });
    })
  );
});
