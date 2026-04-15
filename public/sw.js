// PicoCalc Web Emulator — Service Worker
// Cache version: increment on breaking changes
const CACHE = 'picocalc-v2';
const BASE = '/picocalc-emu/';

// Hashed JS/CSS assets injected at build time by scripts/inject-sw-manifest.mjs
// At dev time this is empty — runtime caching covers them after first load.
const VITE_ASSETS = [];

// Files to pre-cache at install time (must be served from origin)
const PRECACHE = [
  ...VITE_ASSETS,
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'favicon.svg',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  BASE + 'picocalc-device.png',
  BASE + 'bramble.js',
  BASE + 'bramble.wasm',
  BASE + 'firmware.uf2',
];

// --- Install: pre-cache shell -------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Use individual add() so a missing optional file (e.g. firmware.uf2)
      // does not abort the whole install.
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

// --- Activate: delete old caches ----------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// --- Fetch: stale-while-revalidate for HTML; cache-first for assets ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET requests
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // For HTML navigation: network-first so users always get the latest shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return resp;
        })
        .catch(() => caches.match(BASE + 'index.html'))
    );
    return;
  }

  // For everything else: cache-first
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return resp;
        })
    )
  );
});
