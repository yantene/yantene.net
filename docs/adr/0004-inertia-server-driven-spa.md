# 0004. Inertia.js によるサーバー駆動 SPA を採用する

- Status: Accepted
- Date: 2026-07-05
- Deciders: @yantene

## Context / 背景

個人サイトのフロントエンドアーキテクチャを選定する必要がある。要件は SSR 対応 (SEO・OGP)、
React ベースの UI、Hono バックエンドとの統合。

## 検討した選択肢

- **案 A: SPA + 別建て API** — React SPA を Vite で構築、バックエンドは JSON API。
  - Pros: フロント・バック完全分離。API 再利用性。
  - Cons: SSR が難しい (別途 SSR サーバーが必要)。API 設計・バージョニングのコスト。
    データ取得でウォーターフォールが生じやすい。
- **案 B: React メタフレームワーク (Next.js / Remix 等)** — フレームワーク側が SSR とデータ取得を
  統合する。
  - Pros: SSR 標準サポート。エコシステムが大きい。
  - Cons: Cloudflare Workers + Hono との統合にラッパー層が必要。ルーティング・データ取得が
    フロントエンド側に寄り、Hono の責務と重複する。
- **案 C: Inertia.js (@hono/inertia)** — サーバー側でルーティング・データ取得を行い、
  React コンポーネントをページ単位で描画する。
  - Pros: ルーティング・データ取得がサーバーに集約される。API 設計が不要。
    `c.render('page', props)` で SSR + ハイドレーション。Hono との統合がファーストクラス
    (@hono/inertia)。ページ名の型補完 (`pages.gen.ts`)。
  - Cons: Inertia.js 固有の制約 (ページ遷移は XHR ベース)。エコシステムが比較的小さい。

## 決定

案 C (Inertia.js) を採用する。

- バックエンドが `c.render('<page>', props)` でページをレンダリングする。
- ページコンポーネントは `app/frontend/pages/` に kebab-case で配置する。
- SSR は `entry.server.tsx` で `renderToString` を使う。
- 別建ての API は原則設計しない。データは Inertia のページ props で渡す。

## 帰結 / Consequences

- 良い面: API 設計のコストがゼロ。サーバー側で完結するデータフローで
  ウォーターフォールが起きにくい。ページ名の型補完 (`pages.gen.ts`) で安全。
- 悪い面: Inertia のプロトコルに縛られる。SPA 的な自由度は制限される。
  外部から叩く API が必要になった場合は別途 `handlers/api.ts` に書く必要がある。
- 検証方法: 新規画面の追加は必ず Inertia ページとして作成する。
  `c.render` 以外の方法でページを返すハンドラの追加は本 ADR を参照して判断する。

## 参考 / More Information

- Inertia.js: https://inertiajs.com
- @hono/inertia: https://github.com/honojs/middleware/tree/main/packages/inertia
- [0001](0001-record-architecture-decisions.md)
