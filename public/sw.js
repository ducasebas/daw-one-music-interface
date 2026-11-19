// Static shell only. Device APIs are never cached or represented as online.
const CACHE = "daw-one-shell-v53";
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch("./");
      const html = await response.text();
      const paths = [
        ...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css))"/g),
      ].map((m) => m[1]);
      // Lazy settings must also work offline before their first visit. Fetching
      // their immutable files here does not parse/execute them in the main UI.
      const inventory=await fetch('/offline-assets.json',{cache:'no-store'});
      if(!inventory.ok)throw Error('Offline asset inventory unavailable');
      const chunks=await inventory.json();
      if(!Array.isArray(chunks)||chunks.some(path=>typeof path!=='string'||!/^\/assets\/[a-zA-Z0-9_.-]+\.(?:js|css)$/.test(path)))throw Error('Invalid offline asset inventory');
      await cache.addAll([
        "./",
        ...new Set([...paths,...chunks]),
        "/media/startup-still.png",
        "/media/startup.webp",
        "/fonts/Manrope-Variable.ttf",
      ]);
      self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const previous=(await caches.keys()).filter(key=>key!==CACHE&&/^daw-one-shell-v\d+$/.test(key)).sort((a,b)=>Number(b.split('-v')[1])-Number(a.split('-v')[1]));
      // An already-open client may still need its previous lazy chunk URLs.
      for(const key of previous.slice(1))await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    event.request.headers.has("range") ||
    event.request.destination === "video" ||
    /\.(?:mp4|webm)$/i.test(url.pathname)
  )
    return;
  event.respondWith(
    (async () => {
      if(/^\/assets\/[a-zA-Z0-9_.-]+\.(?:js|css)$/.test(url.pathname)){
        const immutable=await caches.match(event.request);
        if(immutable)return immutable;
      }
      try {
        const response = await fetch(event.request);
        if (response.status === 200) {
          // Cache failures must never turn a valid network response into an error.
          // Animated-image replays have a unique query but share one offline copy.
          try {
            const cache = await caches.open(CACHE);
            await cache.put(url.pathname === '/media/startup.webp' ? url.pathname : event.request, response.clone());
          } catch {}
        }
        return response;
      } catch {
        const cached = await caches.match(url.pathname === '/media/startup.webp' ? url.pathname : event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./");
        return Response.error();
      }
    })(),
  );
});
