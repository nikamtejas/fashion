// LuxeLoom service worker: offline shell + static caching.
const CACHE = "luxeloom-v2";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never intercept API calls — payments/auth must always hit the network.
  if (url.pathname.startsWith("/api") || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Network-first pages with the offline shell as fallback.
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Network-first for same-origin static assets, cached copy as the offline
  // fallback. (Cache-first served stale chunks in dev — dev chunk URLs
  // aren't content-hashed, so a cached one shadowed every later code change.)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (url.pathname.startsWith("/_next/static") || PRECACHE.includes(url.pathname))) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? Response.error()))
  );
});

// Lets the page ask the worker to show an order-status notification.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(data.title ?? "LuxeLoom", {
      body: data.body ?? "",
      icon: "/icon.svg",
      data: { link: data.link ?? "/" },
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? "/";
  event.waitUntil(clients.openWindow(link));
});
