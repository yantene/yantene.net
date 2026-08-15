// yantene.net の Service Worker。設計の背景は docs/adr/0010 を参照。
// このファイルはビルドを介さずそのまま配られるので、注記は動作を追うのに要る分だけ。

// 蓄えの意味が変わったら上げる (古い蓄えは有効化時に捨てる)。
//
// offline.html を書き換えたときも上げること。あの中身を蓄えに入れるのは install の
// storeOfflinePage() だけで、install が走り直すのはこのファイルのバイト列が変わったとき
// だけ。ここを据え置くと、すでに Service Worker が入っている読み手には古い案内が
// 出続ける (誰も /offline.html を開かないので networkFirst でも入れ替わらない)。
const CACHE_VERSION = "v2";
const PAGE_CACHE = `pages-${CACHE_VERSION}`;
const ASSET_CACHE = `assets-${CACHE_VERSION}`;

const OFFLINE_URL = "/offline.html";

// 壊れた版を配ったときの逃げ道。true にすると蓄えを捨てて自身を登録解除する。
const IS_KILL_SWITCH = false;

self.addEventListener("install", (event) => {
  if (IS_KILL_SWITCH) return;
  // オフライン時の案内は先に蓄えないと出せない。
  event.waitUntil(storeOfflinePage());
  self.skipWaiting();
});

// cache.add を使わない。配信側が /offline.html を /offline へ転送することがあり、
// 転送を経た応答はそのままでは蓄えられない (put が拒む)。中身を写して入れ直す。
async function storeOfflinePage() {
  const response = await fetch(OFFLINE_URL);
  if (!response.ok) return;

  const cache = await caches.open(PAGE_CACHE);
  const body = await response.blob();
  await cache.put(
    OFFLINE_URL,
    new Response(body, { headers: response.headers }),
  );
}

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

  // 原文 Markdown を名指しした要求には関わらない。記事 URL は Accept 次第で HTML と
  // Markdown に分かれる (docs/adr/0020) ので、同じ鍵で蓄えると次の閲覧に取り違えた
  // ものを返しかねない。判定は粗くてよい — 外したときの向きは常に「触らない」なので、
  // 蓄えを 1 回逃すだけで済む。
  if ((request.headers.get("accept") ?? "").includes("markdown")) return;

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
  if (path.startsWith("/api/")) return false;
  if (["/feed.xml", "/sitemap.xml"].includes(path)) return false;
  // 原文 Markdown は保存目的で開かれるので素通しにする。
  return !path.endsWith(".md");
}

// 蓄えられる応答か。
//
// 転送を経たものは put が拒むので外す (/combsort.html -> /notes/combsort のような
// 旧サイトからの恒久転送がある)。
// 弾かないと put の例外で「通信できなかった」の扱いになり、オフラインの案内が出てしまう。
function isStorable(response) {
  return response.ok && !response.redirected;
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
  if (isStorable(response)) await cache.put(request, response.clone());
  return response;
}

// 記事は書き換わるので、繋がっているときは必ず新しいものを返す。
async function networkFirst(request, isPage) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (isStorable(response)) await cache.put(request, response.clone());
    return response;
  } catch {
    // 鍵の Vary は無視する。記事ページは `Vary: Accept` を出す (docs/adr/0020) ので、
    // 素直に引くと蓄えたときと Accept が 1 バイトでも違えば当たらない。ブラウザが
    // 更新で Accept の並びを変えるだけで、蓄えてある記事が全部オフラインで読めなくなる。
    // 上の fetch リスナーが Markdown を名指しした要求には関わらないので、ここに
    // 蓄わっているのは HTML の表現だけ。取り違える余地はない。
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    if (isPage) {
      const offline = await cache.match(OFFLINE_URL);
      if (offline) return offline;
    }
    throw new Error(`offline and not cached: ${request.url}`);
  }
}
