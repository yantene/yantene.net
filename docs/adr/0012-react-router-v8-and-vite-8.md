# 0012. React Router v8 へ上げ、Vite を 8 系に戻す

- Status: Accepted
- Date: 2026-08-08
- Deciders: @yantene

## Context / 背景

[0010](0010-react-router-v7-over-inertia.md) で React Router v7 (7.18.2) へ移行した際、
Vite 8 系だと SSR ビルドがクライアントのマニフェストを解決できず落ちたため、Vite を
7 系に固定した。同 ADR の帰結にもそう明記している。

その後、React Router v8 が既に安定版として公開されている (8.0.0 は 2026-06-17、
最新 8.3.0) ことを確認した。`pnpm dev` も v8 への Future Flag Warning を 4 件出しており、
v7 は移行パスを提示している状態だった。移行時に v7 を選んだのは、参考実装
(yantene/infoholick) と API を揃えて移植判断を確実にするためで、移植完了後まで
据え置く理由はない。

## 検討した選択肢

- **案 A: v7 に留まる** — 現状維持。
  - Pros: 追加作業がない。
  - Cons: Vite 7 固定が続く。v7 は既に旧メジャーで、future フラグ警告が出続ける。
- **案 B: v8 へ上げ、Vite 8 に戻せるか検証する (採用)**
  - Pros: 旧メジャーからの離脱。Vite 8 に戻せれば 0010 で受け入れた制約を解消できる。
  - Cons: `v8_middleware` により loader の `context` の受け渡し方が変わり、
    全 loader と Worker エントリに手が入る。

## 決定

**案 B を採用する。** 公式の推奨手順どおり、まず v7 のまま future フラグを段階的に
有効化して破壊的変更を吸収し、その後 v8 へ上げた。

- `v8_middleware` により loader の `context` が `RouterContextProvider` になった。
  `context.cloudflare.env` という直接アクセスができなくなるため、コンテキストキー
  (`app/frontend/lib/route-context.ts` の `cloudflareContext` / `nonceContext`) を定義し、
  `workers/app.ts` で詰めて `context.get(...)` で取り出す方式にした。
  これに伴い `AppLoadContext` の宣言マージは不要になった。
- `v8_passThroughRequests` は `request.url` を正規化しなくなるが、loader は `origin` と
  `searchParams` しか見ておらず影響しなかった (canonical に使う pathname は meta 関数の
  `location` から取っている)。
- `v8_splitRouteModules` は v8 でトップレベルの `splitRouteModules` に昇格したため、
  設定をそちらへ移した。他のフラグは v8 の既定の挙動になったので指定しない。
- **Vite 8 (8.2.1) でビルドが通ることを確認したため、8 系へ戻した。** これにより
  `vite-tsconfig-paths` が不要になり、Vite ネイティブの `resolve.tsconfigPaths` へ
  戻して依存をひとつ減らした (vite.config / vitest.config / .storybook いずれも)。

## 帰結 / Consequences

- 良い面: 最新メジャーに追随し、future フラグ警告が消えた。0010 で受け入れた
  「Vite 7 系に固定」の制約が解消され、依存も 1 つ減った。
- 悪い面・トレードオフ: loader が Cloudflare の env を受け取る経路が
  `context.cloudflare.env` から `context.get(cloudflareContext).env` へ変わり、
  一段間接的になった。新しい loader を書くときは route-context.ts のキーを使うこと。
- 検証方法 / 今後の宣言: 全ページ・API のスモーク、ハッシュ付き URL と目次クリックの
  スクロール着地 (見出しが sticky ヘッダー下 80px)、canonical / og:url / og:locale /
  JSON-LD の出力、`wrangler deploy --dry-run` の全環境 pass を本番ビルドで確認した。

## 参考 / More Information

- [0010](0010-react-router-v7-over-inertia.md) — 「Vite は 7 系に固定」と記録したが、
  本 ADR で 8 系に戻した (0010 の決定そのもの (Inertia → React Router) は有効)
- Issue #91
- React Router v8 upgrade guide: https://reactrouter.com/upgrading/v7
