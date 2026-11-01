// Static shell only. Device APIs are never cached or represented as online.
const CACHE = "daw-one-shell-v20";
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch("./");
      const html = await response.text();
      const paths = [
        ...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css))"/g),
      ].map((m) => m[1]);
      await cache.addAll([
        "./",
        ...paths,
        "/media/startup-still.png",
        "/fonts/Manrope-Variable.ttf",
      ]);
      self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./");
        return Response.error();
      }
    })(),
  );
});
