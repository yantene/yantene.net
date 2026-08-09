// yantene.net の Service Worker。設計の背景は docs/adr/0015 を参照。
// このファイルはビルドを介さずそのまま配られるので、注記は動作を追うのに要る分だけ。

// 蓄えの意味が変わったら上げる (古い蓄えは有効化時に捨てる)。
const CACHE_VERSION = "v1";
const PAGE_CACHE = `pages-${CACHE_VERSION}`;
const ASSET_CACHE = `assets-${CACHE_VERSION}`;

const OFFLINE_URL = "/offline.html";

// 壊れた版を配ったときの逃げ道。true にすると蓄えを捨てて自身を登録解除する。
const IS_KILL_SWITCH = false;

self.addEventListener("install", (event) => {
  if (IS_KILL_SWITCH) return;
  // オフライン時の案内は先に蓄えないと出せない。
  event.waitUntil(caches.open(PAGE_CACHE).then((c) => c.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (IS_KILL_SWITCH) {
        const all = await caches.keys();
        await Promise.all(all.map((k) => caches.delete(k)));
        await self.registration.unregister();
        return;
      }

      const keep = new Set([PAGE_CACHE, ASSET_CACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (IS_KILL_SWITCH) return;

  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // 他所のもの (埋め込み動画など) には関わらない。
  if (url.origin !== self.location.origin) return;
  if (!isCacheable(url)) return;

  event.respondWith(
    isImmutableAsset(url)
      ? cacheFirst(request)
      : networkFirst(request, request.mode === "navigate"),
  );
});

// 鮮度が要るものは触らない。
function isCacheable(url) {
  const path = url.pathname;
  if (path.startsWith("/api/") || path.startsWith("/auth/")) return false;
  if (["/logout", "/feed.xml", "/sitemap.xml"].includes(path)) return false;
  // 原文 Markdown は保存目的で開かれるので素通しにする。
  return !path.endsWith(".md");
}

// ファイル名にハッシュが入り、中身が変わらないもの。
function isImmutableAsset(url) {
  if (url.pathname.startsWith("/assets/")) return true;
  return /\.(?:woff2?|png|jpe?g|gif|webp|avif|svg|ico)$/i.test(url.pathname);
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

// 記事は書き換わるので、繋がっているときは必ず新しいものを返す。
async function networkFirst(request, isPage) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (isPage) {
      const offline = await cache.match(OFFLINE_URL);
      if (offline) return offline;
    }
    throw new Error(`offline and not cached: ${request.url}`);
  }
}
