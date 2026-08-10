# yantene.net

yantene の個人ウェブサイト。技術ノート（記事）を Markdown で執筆・公開する。

Cloudflare Workers + Hono + React Router v7 + React + Drizzle ORM で構築。

## 特徴

- **ノート (記事)** — Markdown で技術ノートを執筆・公開する。コンテンツは R2 (オブジェクトストレージ)、
  メタデータは D1 (SQLite) に保存。スラグベースの URL ルーティングとページネーション。
- **エッジで完結** — Cloudflare Workers + D1 + R2 のみ。外部 DB もオリジンサーバーも立てずに動く。
- **サーバー駆動 SPA** — React Router v7 のフレームワークモード。loader でデータ取得を
  サーバーへ集約し、SSR・ハイドレーション・クライアント遷移が別建ての API なしで成立する。
- **端から端まで型安全** — TypeScript strict、Drizzle、ルートごとの型生成
  (`react-router typegen` が `./+types/*` を生成)、Value Object と typed error でドメイン制約を型に乗せる。
- **Clean Architecture** — domain / infra / services / handlers のレイヤーと依存方向、CQRS
  リポジトリ分割、Composition Root での依存注入を `.claude/rules/` に明文化。
- **静かに劣化させない (fail-loud)** — 設定不備やキャッシュ不整合は、それらしく動き続けずに
  明示的に失敗させる。
- **設計判断を記録** — Architecture Decision Records (`docs/adr/`) で設計の「なぜ」を永続化。
- **開発体験** — DevContainer、ESLint (Flat Config) + Prettier、Vitest、Storybook、i18next
  (en / ja)、GitHub Actions による CI/CD。

## 技術スタック

| 技術                                    | 役割                               |
| --------------------------------------- | ---------------------------------- |
| Cloudflare Workers                      | エッジランタイム、D1 (SQLite)、R2  |
| Hono                                    | HTTP 層 (API・secure headers)      |
| React Router v7                         | ルーティング・loader・SSR          |
| React 19                                | UI とハイドレーション              |
| Drizzle ORM                             | 型安全な DB アクセス (D1 / SQLite) |
| Tailwind CSS v4 + daisyUI v5            | スタイリング                       |
| TypeScript / ESLint / Prettier / Vitest | 型・静的解析・整形・テスト         |

## クイックスタート

前提: Node.js 24 系・pnpm 11 系 (DevContainer を使う場合は同梱の `.devcontainer/` で自動構築)。

```bash
pnpm install            # 依存導入 + 型生成 (postinstall で wrangler types)
pnpm run db:dev:migrate # ローカル D1 にマイグレーション適用 (初回必須)
pnpm dev                # 開発サーバー (http://localhost:5173)
```

> ⚠️ `db:dev:migrate` を忘れると、ノート一覧が `no such table: notes` で落ちる。
> 開発 DB を作り直したいときは `pnpm run db:dev:reset`。

## ディレクトリ構造

```
app/
├── backend/                # Hono バックエンド (Clean Architecture)
│   ├── domain/             # ドメイン層 (インフラ非依存): entity / VO / repo・port interface
│   ├── infra/              # インフラ層: d1 / r2 / github / console (domain の interface を実装)
│   ├── services/           # アプリケーションサービス (ユースケース)
│   ├── handlers/           # HTTP ハンドラ (Composition Root): notes/ / feed / og / seo
│   ├── middleware/         # BASIC 認証
│   └── index.ts            # Hono アプリ (default export, wrangler の main)
├── frontend/               # React Router v7 アプリケーション
│   ├── routes/             # ページルート (loader / meta / component を同居)
│   ├── routes.ts           # ルート定義
│   ├── root.tsx            # HTML シェル + 既定 meta + ErrorBoundary
│   ├── layouts/            # 共通レイアウト
│   ├── lib/                # page-meta / nonce-context
│   ├── entry.client.tsx    # HydratedRouter (クライアント)
│   ├── entry.server.tsx    # ServerRouter (SSR)
│   └── app.css             # Tailwind + daisyUI エントリ
└── lib/                    # フロント・バック共通 (i18n リソース / constants)

workers/app.ts              # Worker エントリ (Hono → React Router へ委譲)
migrations/                 # Drizzle 生成済みマイグレーション
docs/adr/                   # Architecture Decision Records (設計判断の記録)
.claude/rules/              # プロジェクト規約 (CLAUDE.md が読み込む)
```

Cloudflare Worker のエントリポイントは `workers/app.ts`。`getApp()` が組み立てた Hono が
API・フィード等を先に処理し、残りを React Router のページルーティングへ委譲する
(詳細は [ADR 0006](docs/adr/0006-react-router-framework-mode.md))。

## 使い方レシピ

### ページを追加する

1. `app/frontend/routes/<name>.tsx` (kebab-case) にルートモジュールを追加
   ```tsx
   import type { Route } from "./+types/about";

   export async function loader({ context }: Route.LoaderArgs) {
     return { message: "Hi" };
   }

   export default function About({ loaderData }: Route.ComponentProps) {
     return <main>{loaderData.message}</main>;
   }
   ```
2. `app/frontend/routes.ts` に登録
   ```ts
   route("about", "routes/about.tsx"),
   ```
3. `pnpm run rr-typegen` が `./+types/about` を生成し、loader の戻り値・params・meta が
   型で結びつく。動的セグメントは `notes.$slug.tsx` のようにドット区切りで置く。

データ取得は loader に直接書かず、`backend/handlers/**` の `loadXxxPage(env, ...)` を
呼ぶ (Composition Root を handlers に保つ)。OGP・JSON-LD は `meta` で
`buildPageMeta()` を使って出す。

### ドメイン機能を追加する (CQRS + VO)

1. `domain/<集約>/` に entity・Value Object (`*.vo.ts`)・リポジトリ interface を定義
   (Command / Query を分割)。技術名 (D1 / R2 等) は持ち込まない。
2. `infra/<技術>/` で interface を実装する。
3. `services/` にユースケースを書き、ハンドラ (Composition Root) で infra を生成して注入する。
4. HTTP ステータスへのマッピングはハンドラ層のみ。詳細は
   [.claude/rules/architecture.md](.claude/rules/architecture.md)。

## コマンド

```bash
pnpm dev              # Vite 開発サーバー (Cloudflare Workers エミュレート)
pnpm test             # Vitest watch mode
pnpm run test:run     # Vitest 1 回実行
pnpm run lint         # ESLint
pnpm run lint:fix     # ESLint 自動修正
pnpm run format       # Prettier
pnpm run format:fix   # Prettier 自動修正
pnpm run fix          # ESLint + Prettier 自動修正
pnpm run typecheck    # typegen + tsc -b
pnpm run check        # lint + format + typecheck (読取検証)
pnpm run build        # Vite ビルド
pnpm run preview      # build → vite preview

pnpm run db:generate --name <intent>  # マイグレーション生成 (意図を表す名前を付ける)
pnpm run db:dev:migrate               # local D1 に適用
pnpm run db:dev:reset                 # local D1 をリセット

pnpm run storybook:dev        # Storybook 起動
pnpm run storybook:build      # Storybook ビルド

pnpm run deploy:staging       # staging へ手動デプロイ (通常は CI 自動)
pnpm run deploy:production    # production へ手動デプロイ
pnpm run release              # GitHub Release を切る (production デプロイのトリガー)
```

## 環境とデプロイ

| 環境        | トリガー          | 用途                      |
| ----------- | ----------------- | ------------------------- |
| development | `pnpm dev`        | ローカル開発              |
| staging     | PR / push to main | 検証環境 (BASIC 認証付き) |
| production  | GitHub Release    | 本番環境                  |

- ビルド時に `CLOUDFLARE_ENV=staging|production pnpm run build` で環境を切り替える。
- production は `pnpm run release` → GitHub Release 公開 → `deploy-production.yml` で自動デプロイ。

> ⚠️ ステージング環境の BASIC 認証 (`middleware/basic-auth.ts`) は削除しないこと。
> `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` が設定されている場合のみ有効化される。

## アーキテクチャと規約

設計方針・規約・運用ルールはリポジトリにドキュメント化されている。

- [CLAUDE.md](CLAUDE.md) — 規約の入口 (`.claude/rules/*` を読み込む)
- [.claude/rules/architecture.md](.claude/rules/architecture.md) — 設計思想・レイヤー・命名・配置ルール
- [.claude/rules/environments.md](.claude/rules/environments.md) — 環境構成・BASIC 認証
- [docs/adr/](docs/adr/) — アーキテクチャ決定の記録 (ADR)

## License

MIT
