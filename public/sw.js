/* Mundial '26 service worker — installable PWA + offline app shell.
 * Strategy: never touch /api (always live); cache-first for static assets;
 * network-first for page navigations with an offline fallback. */
const VERSION = "v1";
const SHELL = `mundial-shell-${VERSION}`;
const ASSETS = `mundial-assets-${VERSION}`;
const PRECACHE = ["/", "/login", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  /* never cache dynamic data — tRPC / auth / cron stay live */
  if (url.pathname.startsWith("/api/")) return;

  /* page navigations: network-first, fall back to cached shell when offline */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
    );
    return;
  }

  /* static assets: cache-first, revalidate in the background */
  if (url.pathname.startsWith("/_next/") || /\.(png|svg|ico|webp|jpg|jpeg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(request, copy));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
