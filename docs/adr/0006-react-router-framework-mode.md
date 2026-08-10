# 0006. ページ描画は React Router のフレームワークモードに任せる

- Status: Accepted
- Date: 2026-08-08
- Deciders: @yantene

## Context / 背景

Cloudflare Workers + Hono の上で、SSR (SEO・OGP・クローラー対応) を伴う React の画面を
出す必要がある。決めるべきは「ルーティングとデータ取得をどこが持つか」で、これは
Hono の責務範囲を直接左右する。

読み物のサイトなので、スクロールの挙動が体験の質に直結する。ハッシュ付き URL
(`/notes/<slug>#<見出し>`) で開いたときの見出しへの着地、目次クリック、ブラウザバックでの
位置復元は、いずれも SSR + hydration + 画像の遅延読み込みが絡むと壊れやすい。
これらを自前で面倒を見続けるか、フレームワークに委ねるかの選択でもある。

## 検討した選択肢

- **案 A: SPA + 別建て API** — React SPA を Vite で構築、バックエンドは JSON API。
  - Pros: フロント・バック完全分離。API 再利用性。
  - Cons: SSR が難しい (別途 SSR サーバーが必要)。データ取得でウォーターフォールが生じやすい。
    スクロール位置管理はすべて自前。
- **案 B: サーバー駆動 SPA (Inertia 等)** — サーバー側でルーティング・データ取得を行い、
  React コンポーネントをページ単位で描画する。
  - Pros: ルーティング・データ取得がサーバーに集約され、Hono の責務と重複しない。
  - Cons: スクロール位置の復元を自前で抱え続ける。ハッシュアンカー・戻る/進む・ページ送りで
    同種の実装が要る。エコシステムが比較的小さい。
- **案 C: React Router のフレームワークモード (採用)** — ルーティングとデータ取得を
  ルートモジュールの loader に置き、Hono は API・フィード・HTTP 横断関心事に専念させる。
  - Pros: `<ScrollRestoration />` が標準で、スクロール位置の管理をフレームワークが引き受ける。
    ルート単位の型生成 (`./+types/*`)、`meta` による OGP/JSON-LD の宣言的記述、
    エコシステムの厚さ。
  - Cons: ルーティングとデータ取得の一部がフロントエンド側 (loader) に寄り、Hono の
    責務と一部重なる。

## 決定

案 C を採用する。React Router v8 のフレームワークモードを使う。

### Hono と React Router の分担

- Worker のエントリは `workers/app.ts`。`getApp(handler)` で組み立てた Hono から
  `app.all("*")` で React Router のリクエストハンドラへ委譲する。
- Hono が先に応答するのは横断的関心事とページ以外のエンドポイント:
  secure headers / BASIC 認証 / JSON API (`/api/**`) / フィード・OG 画像・sitemap /
  ノートの原文 Markdown (`/notes/<slug>.md`)。**ページ描画はすべて React Router。**
- ページは `app/frontend/routes/` に置き、`routes.ts` に登録する。データ取得は loader から
  `~/backend/handlers/**` の `loadXxxPage(env, ...)` を呼ぶ。Composition Root が handlers に
  ある構造は維持する ([0003](0003-clean-architecture-and-cqrs.md))。

### loader が env を受け取る経路

`v8_middleware` により loader の `context` は `RouterContextProvider` になっている。
`context.cloudflare.env` のような直接アクセスはできないので、コンテキストキー
(`app/frontend/lib/route-context.ts` の `cloudflareContext` / `nonceRouteContext`) を定義し、
`workers/app.ts` で詰めて `context.get(...)` で取り出す。新しい loader を書くときは
必ずこのキーを使う。

### その他の約束

- OGP・JSON-LD は `meta` 関数で組み立てる (`app/frontend/lib/page-meta.ts` の
  `buildPageMeta` に集約)。React Router の `meta` は最も深いルートのものだけが採用され
  親とマージされないため、各ページが一式を出す。
- CSP nonce は `secureHeadersNonce` → `AppLoadContext` → `NonceContext` の経路で
  `<Scripts>` / `<ScrollRestoration>` へ渡す ([0007](0007-strict-csp-outside-development.md))。
- ページ内アンカー (目次など) は `react-router` の `Link` を使う。素の `<a href="#...">` だと
  `<ScrollRestoration>` がブラウザのハッシュジャンプを打ち消してスクロールしない。
- ビルドは `build/client` と `build/server` に分かれる。`wrangler.jsonc` の main を直接
  dry-run すると `virtual:react-router/server-build` を解決できないため、CI は各環境で
  ビルドしてから `build/server/wrangler.json` を検証する。

## 帰結 / Consequences

- 良い面: ハッシュ付き URL・目次クリック・ブラウザバックのいずれでもスクロールが正しく効く。
  ルートごとの型生成でページ props の型安全性が上がる。スクロール位置管理をフレームワークに
  委ねられる。
- 悪い面・トレードオフ: loader が Cloudflare の env を受け取る経路が `context.get(...)` の
  一段間接的な形になる。ルーティングの定義が `routes.ts` (React Router) と
  `app/backend/index.ts` (Hono) の二箇所に分かれ、どちらが応答するかの優先順位を
  意識する必要がある。
- 検証方法 / 今後の宣言: 全ページ共通の meta 生成は `page-meta.test.ts` が jsonLd 有無の
  両パスを検証する。**全ページが通る共有経路 (`root.tsx` / `page-meta.ts` / `layouts/` /
  `entry.server.tsx` / `workers/app.ts`) を変えたら、記事ページだけでなく各ページ種別を
  確認する。** デプロイ後は `pnpm run smoke` で主要 URL に 5xx が無いことを確認する。

## 参考 / More Information

- React Router: https://reactrouter.com/
- 実装: `workers/app.ts` / `app/backend/index.ts` / `app/frontend/routes.ts`
- [0003](0003-clean-architecture-and-cqrs.md) / [0007](0007-strict-csp-outside-development.md)
