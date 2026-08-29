/**
 * Cache-first service worker scoped (by pathname check) to the movi-player
 * vendor bundle. All other requests pass through untouched. URLs carry a
 * content-hash `?v=` query, so a new movi build is a new cache entry; stale
 * entries for the same pathname are evicted on write.
 */
const CACHE_NAME = "movi-player-vendor-v1";
const VENDOR_PATH = "/vendor/movi-player/";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("movi-player-vendor-") && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request);
  if (hit) {
    return hit;
  }
  const response = await fetch(request);
  if (response.ok) {
    const pathname = new URL(request.url).pathname;
    const keys = await cache.keys();
    await Promise.all(
      keys
        .filter((key) => new URL(key.url).pathname === pathname)
        .map((key) => cache.delete(key)),
    );
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(VENDOR_PATH)
  ) {
    return;
  }
  event.respondWith(cacheFirst(event.request));
});
