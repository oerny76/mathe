const CACHE_NAME = "mathe-pwa-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./shared.js",
  "./app.js",
  "./manifest.json",
  "./tj/",
  "./tj/index.html",
  "./tj/manifest.json",
  "./mj/",
  "./mj/index.html",
  "./mj/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Aufgaben-JSONs: immer zuerst versuchen, aus dem Netz zu holen (neue Aufgaben!),
  // nur bei Fehler auf den Cache zurückfallen.
  if (url.pathname.includes("/data/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App-Shell (HTML/JS/CSS/Manifest): immer zuerst versuchen, aus dem Netz zu
  // holen, damit ein neuer Deploy sofort ankommt (sonst kann ein alter,
  // gecachter app.js gegen neues HTML laufen und mit einer leeren Seite
  // abstürzen) – Cache nur als Fallback ohne Netz.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
