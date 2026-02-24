/// @ts-nocheck
// Service Worker for やんてね！ PWA
// Cache strategies:
//   - Static assets (JS, CSS, fonts, images): Cache-First
//   - HTML pages and API responses: Network-First with cache fallback

const CACHE_VERSION = "v1";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

const STATIC_EXTENSIONS = [
  ".js",
  ".css",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".ico",
];

const PRECACHE_URLS = ["/", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  globalThis.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) => key.startsWith("static-") || key.startsWith("dynamic-"),
          )
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  globalThis.clients.claim();
});

function isStaticAsset(url) {
  const pathname = new URL(url).pathname;
  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

function isApiRequest(url) {
  return new URL(url).pathname.startsWith("/api/");
}

// Cache-First: static assets
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

// Network-First: HTML pages
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Return a basic offline response for navigation requests
    if (request.mode === "navigate") {
      return new Response(
        "<!DOCTYPE html><html lang='ja'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>オフライン - やんてね！</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5fa;color:#333}main{text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:1rem}p{color:#666}</style></head><body><main><h1>オフライン</h1><p>現在インターネットに接続できません。</p><p>接続が回復したら再度お試しください。</p></main></body></html>",
        {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }
    return new Response("Offline", { status: 503 });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests (except Google Fonts)
  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin &&
    !url.hostname.includes("fonts.googleapis.com") &&
    !url.hostname.includes("fonts.gstatic.com")
  ) {
    return;
  }

  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isApiRequest(request.url)) {
    // Network-only for API (don't cache API responses by default)
    return;
  }

  // Network-First for navigation / HTML
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});
