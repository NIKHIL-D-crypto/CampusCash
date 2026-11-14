/* CampusCash service worker: makes the app installable and usable offline.
   It only ever caches this app's own files (same folder). Your financial data lives in localStorage and is never
   touched by the worker. To ship an update, change CACHE below (e.g. v2) so devices fetch the new files. */
const CACHE = "campuscash-shell-v10";
const SHELL = [
  "./", "index.html", "overview.html", "wallet.html", "404.html",
  "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"
];

self.addEventListener("install", e => {
  // Save each file on its own. addAll() is all-or-nothing: one missing file (for example an icon that was not uploaded yet)
  // used to make the whole worker fail to install, and Chrome then refused to offer "Install app".
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("campuscash-shell-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pages: try the network first (so updates show up as soon as you are online), fall back to the saved copy when offline
// or when the network is slow (3 s). Everything else (icons, manifest): saved copy first.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 3000))]);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req, { ignoreSearch: true })) || (await cache.match("index.html")) || Response.error();
      }
    })());
    return;
  }

  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
