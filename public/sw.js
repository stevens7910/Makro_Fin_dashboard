/**
 * Service Worker pro CZ MakroFin PWA Dashboard
 * Strategie:
 * 1. Precache klíčových aplikačních souborů a lokálního datasetu (/data/macro-data.json)
 * 2. Stale-While-Revalidate pro lokální datové soubory a statické assety (okamžitá odezva + tichá aktualizace)
 * 3. Network-First s Cache fallbackem pro externí API (ČNB ARAD, ČSÚ DataStat)
 * 4. Plná podpora offline režimu včetně navigačního fallbacku na index.html
 */

const CACHE_VERSION = 'cz-makrofin-v1.2.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/data/macro-data.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
          .map((oldKey) => caches.delete(oldKey))
      )
    ).then(() => self.clients.claim())
  );
});

// Zprávy z aplikace (např. ruční promazání SW cache nebo vynucení aktualizace)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_DATA_CACHE') {
    caches.delete(DATA_CACHE).then(() => {
      if (event.source) {
        event.source.postMessage({ type: 'DATA_CACHE_CLEARED', timestamp: Date.now() });
      }
    });
  }

  if (event.data.type === 'GET_SW_STATUS') {
    Promise.all([
      caches.open(STATIC_CACHE).then((c) => c.keys()),
      caches.open(DATA_CACHE).then((c) => c.keys())
    ]).then(([staticKeys, dataKeys]) => {
      if (event.source) {
        event.source.postMessage({
          type: 'SW_STATUS_REPORT',
          version: CACHE_VERSION,
          staticCount: staticKeys.length,
          dataCount: dataKeys.length
        });
      }
    });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignorovat Vite HMR / websocket dotazy při vývoji
  if (url.pathname.startsWith('/@') || url.pathname.includes('node_modules') || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // 1. Datové soubory (/data/macro-data.json) nebo API volání (ČNB / ČSÚ) -> Network-First / Stale-While-Revalidate s uložením do DATA_CACHE
  const isDataRequest =
    url.pathname.startsWith('/data/') ||
    url.hostname.includes('cnb.cz') ||
    url.hostname.includes('czso.cz') ||
    url.hostname.includes('csu.gov.cz');

  if (isDataRequest) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback do STATIC_CACHE, kde je precachovaný /data/macro-data.json
          const staticFallback = await caches.match(request);
          if (staticFallback) return staticFallback;
          throw err;
        }
      })
    );
    return;
  }

  // 2. Navigační požadavky (SPA) -> Network-First s fallbackem na /index.html v cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          return cachedPage || caches.match('/index.html');
        })
    );
    return;
  }

  // 3. Statické assety (JS, CSS, SVG, PNG, fonty) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
