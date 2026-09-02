const CACHE_NAME = 'panel-pro-android-v14-domain-sync';
const APP_SHELL = [
  './login.html',
  './organizatie-bun-venit.html',
  './organizatie-noua.html',
  './creare-organizatie-voucher.html',
  './administrare-organizatie.html',
  './index.html',
  './manifest.webmanifest',
  './img/logo-192.png',
  './img/logo-512.png',
  './img/favicon.ico',
  './css/global-footer.css',
  './css/ios-app.css',
  './js/discord-config.js',
  './js/supabase-config.js',
  './js/project-version.js',
  './js/global-footer.js',
  './js/ios-runtime.js',
  './js/panel-layout.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(new Request(event.request, { cache: 'no-store' }))
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./login.html')))
  );
});
