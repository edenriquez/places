/* Service worker de Entre Lugares.
 * - Páginas: siempre de la red (dependen de la sesión y la ubicación); sin conexión, /offline.
 * - /_next/static: llevan hash en el nombre y nunca cambian → caché primero.
 * - Imágenes optimizadas e íconos: de la caché al instante y se refrescan por detrás (con tope de entradas).
 * - Todo lo demás (API, auth, Supabase, teselas del mapa, otros dominios) pasa directo a la red.
 * Cambiar VERSION invalida las cachés anteriores.
 */
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const IMAGES = `images-${VERSION}`;
const OFFLINE = "/offline";
const PRECACHE = [OFFLINE, "/icon-192.png", "/icon.svg"];
const MAX_IMAGES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== IMAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(IMAGES);
  const cached = await cache.match(event.request);
  const fresh = fetch(event.request).then((response) => {
    if (response.ok) event.waitUntil(cache.put(event.request, response.clone()).then(() => trim(IMAGES, MAX_IMAGES)));
    return response;
  });
  if (cached) {
    event.waitUntil(fresh.catch(() => {}));
    return cached;
  }
  return fresh;
}

async function networkOrOffline(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(OFFLINE)) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkOrOffline(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith("/_next/image") || /\.(png|svg|ico|webp|avif|jpg)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
