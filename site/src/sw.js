const DEV = false;
if (!DEV) {
  const CACHE_NAME = 'my-cache-v1';
  const CACHE_TTL = 24 * 3600e3;
  const SINGLE_CACHE_KEY = '/single-cache-key';
  const ONREGISTER = Date.now();

  self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME));
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              return caches.delete(cache);
            }
          })
        )
      )
    );
  });

  self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if(url == '/src/sw.js' && ONREGISTER >= (Date.now() - CACHE_TTL))
      return;
    const usws = url.pathname.startsWith('/src/');

    if (!url.pathname.startsWith('/api/')) {
      event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
          const cachedResponse = await cache.match(event.request);

          if (cachedResponse) {
            const dateHeader = cachedResponse.headers.get('sw-cache-time');
            if (dateHeader && (Date.now() - new Date(dateHeader).getTime()) < CACHE_TTL) {
              return cachedResponse;
            }
          }

          const networkResponse = await fetch(event.request);
          const responseClone = networkResponse.clone();

          if (networkResponse.ok) {
            const headers = new Headers(responseClone.headers);
            headers.set('sw-cache-time', new Date().toISOString());

            const responseWithTime = new Response(responseClone.body, {
              status: responseClone.status,
              statusText: responseClone.statusText,
              headers
            });

            cache.put(usws ? event.request : SINGLE_CACHE_KEY, responseWithTime);
          }

          return networkResponse;
        })
      );
    } else {
      event.respondWith(fetch(event.request));
    }
  });
}