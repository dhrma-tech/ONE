/// <reference lib="webworker" />
// ONE's single root service worker (scope "/") for all 5 installable apps.
// Precache the app shell + fonts; navigations under /career|/mind|/body|/persona get that app's HTML
// (so its own manifest stays linked offline); API GETs use stale-while-revalidate; frame thumbnails cache-first.
// /chess-app/ is left to Bobby's own service worker. Writes never go through here: the app's outbox syncs later.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkOnly, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const SECTIONS = ["career", "mind", "body", "persona"];
const handlers = Object.fromEntries(SECTIONS.map((s) => [s, createHandlerBoundToURL(`/${s}/index.html`)]));
const master = createHandlerBoundToURL("/index.html");

registerRoute(
  new NavigationRoute(
    (opts) => {
      const seg = new URL(opts.request.url).pathname.split("/")[1];
      return (SECTIONS.includes(seg) ? handlers[seg] : master)(opts);
    },
    { denylist: [/^\/api\//, /^\/chess-app\//, /^\/auth\/callback/] },
  ),
);

// Our own API: read-only GETs can be served stale while refreshing. OAuth, cron and writes always hit the network.
registerRoute(({ url, request }) => url.origin === location.origin && url.pathname.startsWith("/api/") && request.method === "GET" && !/^\/api\/(google\/callback|cron|public-stats)/.test(url.pathname), new StaleWhileRevalidate({ cacheName: "one-api", plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 7 * 86400 })] }));
registerRoute(({ url }) => url.origin === location.origin && url.pathname.startsWith("/api/"), new NetworkOnly());

// In-video frame thumbnails and candidate packs.
registerRoute(({ url }) => url.hostname === "i.ytimg.com", new CacheFirst({ cacheName: "one-thumbs", plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 86400 })] }));
registerRoute(({ url }) => url.origin === location.origin && url.pathname.startsWith("/packs/"), new CacheFirst({ cacheName: "one-packs", plugins: [new ExpirationPlugin({ maxEntries: 10 })] }));

self.addEventListener("message", (e) => {
  if ((e.data as { type?: string })?.type === "SKIP_WAITING") void self.skipWaiting();
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
