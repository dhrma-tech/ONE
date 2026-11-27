/* Bobby service worker.
   - Heavy runtime assets (Pyodide, Stockfish WASM) are cache-first: downloaded once, then instant and offline.
   - Python sources and data are stale-while-revalidate so updates arrive on the next open.
   - The app shell is network-first with a cached fallback. Cross-origin requests (LLM providers) are never cached. */
const VERSION = "bobby-v1";
const HEAVY = VERSION + "-runtime";
const SHELL = VERSION + "-shell";
const PRECACHE = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (cache, req, res) => { if (res && res.ok) { const c = res.clone(); caches.open(cache).then((k) => k.put(req, c)); } return res; };

self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  const p = u.pathname;
  if (p.includes("/pyodide/") || p.includes("/engine/")) {
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => put(HEAVY, r, res))));
    return;
  }
  if (p.includes("/py/") || p.includes("/data/")) {
    e.respondWith(caches.match(r).then((m) => {
      const net = fetch(r).then((res) => put(SHELL, r, res)).catch(() => m || Response.error());
      return m || net;
    }));
    return;
  }
  e.respondWith(
    fetch(r).then((res) => put(SHELL, r, res))
      .catch(() => caches.match(r).then((m) => m || (r.mode === "navigate" ? caches.match("./") : Response.error())))
  );
});
