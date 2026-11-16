const CACHE = "jarvis-hud-v8";
const FILES = ["./", "./index.html", "./css/hud.css", "./js/app.js", "./manifest.webmanifest", "./icons/icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Same-origin only (API calls to OpenAI/Gemini are never cached).
// Stale-while-revalidate: instant load from cache, refreshed in the background.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
          return res;
        })
        .catch(() => hit || (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error()));
      return hit || net;
    })
  );
});
