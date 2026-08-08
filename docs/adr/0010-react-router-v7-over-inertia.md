# 0010. Inertia.js をやめて React Router v7 のフレームワークモードに移行する

- Status: Accepted
- Date: 2026-08-08
- Deciders: @yantene

## Context / 背景

[0004](0004-inertia-server-driven-spa.md) で Inertia.js によるサーバー駆動 SPA を採用し、
ノート機能一式を実装した。運用に入って、ハッシュ付き URL
(`/notes/<slug>#<見出し>`) で記事を開くと目次の見出しへスクロールしない不具合が出た。

調査の結果、原因は Inertia のプロトコルではなく「SSR + hydration + 寸法未指定の
lazy 画像」の組み合わせだった。切り分けは次のとおり。

- 同じ HTML から `<script>` を除去すると正常に飛ぶ (hydration が壊している)
- 画像を含まない記事では正常に飛ぶ
- 画像を含む記事では本番ビルドで 5 秒経過しても `scrollY: 0` のまま

つまり React で SSR する限りどのフレームワークでも踏みうる穴で、Inertia 固有の欠陥では
ない。しかし Inertia はスクロール位置の復元を自前で面倒を見る必要があり、ハッシュ
アンカーだけでなくブラウザバック時の位置復元など、同種の穴を今後も塞ぎ続けることに
なる。React Router v7 は `<ScrollRestoration />` を標準で持ち、この領域を
フレームワーク側が引き受ける。

## 検討した選択肢

- **案 A: Inertia を維持し、スクロール復元だけ自前で実装する** — hydration 後に
  `location.hash` の要素へスクロールし直すユーティリティを共通化する。
  - Pros: 変更が数行に収まる。0004 の決定を維持できる。移行コストゼロ。
  - Cons: スクロール位置管理を恒久的に自前で抱える。ハッシュ以外 (戻る/進む、
    ページ送り) でも同種の実装が要る。
- **案 B: React Router v7 のフレームワークモードへ移行する (採用)** — ルーティングと
  データ取得を loader に移し、Hono は API・フィード・認証フローと HTTP 横断関心事に
  専念させる。
  - Pros: `<ScrollRestoration />` が標準。ルート単位の型生成 (`./+types/*`)、
    `meta` による OGP/JSON-LD の宣言的記述、エコシステムの厚さ。
  - Cons: 移行コストが大きい。0004 を覆す。Hono とページルーティングの責務分割を
    引き直す必要がある。
- **案 C: 画像の寸法付与だけで対処する** — refresh 時に画像サイズを取得して
  width/height を埋める。
  - Pros: CLS が根本的に改善する。フレームワークに依存しない。
  - Cons: 今回の症状の主因は hydration であり、これだけでは直らない。

## 決定

**案 B を採用**する。フロントエンドを React Router v7 のフレームワークモードへ移行し、
0004 を Superseded にする。

- Worker のエントリを `workers/app.ts` に置き、`getApp(handler)` で組み立てた Hono から
  `app.all("*")` で React Router のリクエストハンドラへ委譲する。
- Hono が受け持つのは secure headers / BASIC 認証 / JSON API / フィード・OG 画像・
  sitemap / 認証フロー (magic link・logout)。ページ描画はすべて React Router。
- ページは `app/frontend/routes/` に置き、データ取得は loader から
  `~/backend/handlers/**` の関数を呼ぶ。Composition Root が handlers にある構造は維持する。
- OGP・JSON-LD は `meta` 関数で組み立てる (`app/frontend/lib/page-meta.ts` に集約)。
- CSP nonce は `secureHeadersNonce` → `AppLoadContext.nonce` → `NonceContext` の経路で
  `<Scripts>` / `<ScrollRestoration>` へ渡し、ADR 0009 の「`unsafe-inline` なし」を維持する。

案 C は本 ADR の対象外として残す (別 Issue)。フレームワークを替えても寸法未指定による
CLS は残るため、いずれ対処する。

## 帰結 / Consequences

- 良い面: ハッシュ付き URL・目次クリックの双方でスクロールが正しく効くようになった
  (実測: 見出しが sticky ヘッダーの下 80px に着地)。ルートごとの型生成でページ props の
  型安全性が上がった。スクロール位置管理をフレームワークに委ねられる。
- 悪い面・トレードオフ: ルーティングとデータ取得の一部がフロントエンド側 (loader) に
  寄り、0004 が案 B (メタフレームワーク) を却下した理由「Hono の責務と重複する」を
  部分的に受け入れた形になる。Vite は 8 系だと React Router v7 とビルドが噛み合わない
  ため 7 系に固定した。
- 検証方法 / 今後の宣言: 目次リンクは `react-router` の `Link` を使う (素の
  `<a href="#...">` は ScrollRestoration がブラウザのジャンプを打ち消す)。全ページ共通の
  meta 生成は `page-meta.test.ts` が jsonLd 有無の両パスを検証する。デプロイ後は
  `pnpm run smoke` で主要 URL を確認する。

## 参考 / More Information

- [0004](0004-inertia-server-driven-spa.md) (本 ADR により Superseded)
- [0009](0009-strict-csp-without-unsafe-inline.md) — nonce の受け渡しはこの制約下で行う
- Issue #89
- React Router: https://reactrouter.com/
