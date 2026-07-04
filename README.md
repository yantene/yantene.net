# yantene

Cloudflare Workers 上で動く **Hono + Inertia.js + React + Drizzle ORM** のフルスタック Web
アプリケーション boilerplate。サーバー駆動 SPA・端から端までの型安全・Clean Architecture を、
エッジランタイムだけで完結する形にまとめている。パスワードレス認証が最初から動く。

## 特徴

- **エッジで完結** — Cloudflare Workers + D1 (SQLite) + KV + Email Routing のみ。外部 DB や
  メール SaaS を立てずに、認証付きアプリがそのまま動く。
- **サーバー駆動 SPA** — Inertia.js でルーティングとデータ取得をサーバーへ集約。別建ての
  API を設計せずに、SSR・ハイドレーション・クライアント遷移が成立する。
- **端から端まで型安全** — TypeScript strict、Drizzle、`c.render('<page>')` のページ名補完
  (`@hono/inertia/vite` が `pages.gen.ts` を生成)、Value Object と typed error でドメイン制約を型に乗せる。
- **Clean Architecture** — domain / infra / services / handlers のレイヤーと依存方向、CQRS
  リポジトリ分割、Composition Root での依存注入を `.claude/rules/` に明文化している。
- **パスワードレス認証を同梱** — magic link 方式のログイン (後述のデモ) が最初から組み込み済み。
- **環境別の挙動を fail-loud に** — メール送信は development=Console / staging・production=実送信を
  自動で解決。設定不備は静かに劣化させず、明示的に失敗させる。
- **設計判断を記録** — Architecture Decision Records (`docs/adr/`) を運用するための土台付き。
- **開発体験** — DevContainer、ESLint (Flat Config) + Prettier、Vitest、Storybook、i18next
  (en / ja)、GitHub Actions による CI/CD。

## 技術スタック

| 技術                                    | 役割                                     |
| --------------------------------------- | ---------------------------------------- |
| Cloudflare Workers                      | エッジランタイム、D1 (SQLite)、KV、Email |
| Hono                                    | バックエンド + Inertia.js ホスト         |
| Inertia.js (`@hono/inertia`)            | サーバー駆動 SPA プロトコル              |
| React 19 (`@inertiajs/react`)           | UI とハイドレーション                    |
| Drizzle ORM                             | 型安全な DB アクセス (D1 / SQLite)       |
| Tailwind CSS v4 + daisyUI v5            | スタイリング                             |
| TypeScript / ESLint / Prettier / Vitest | 型・静的解析・整形・テスト               |

## クイックスタート

前提: Node.js 24 系・pnpm 11 系 (DevContainer を使う場合は同梱の `.devcontainer/` で自動構築)。

```bash
pnpm install            # 依存導入 + 型生成 (postinstall で wrangler types)
pnpm run db:dev:migrate # ローカル D1 にマイグレーション適用 (初回必須)
pnpm dev                # 開発サーバー (http://localhost:5173)
```

> ⚠️ `db:dev:migrate` を忘れると、ログイン時に `no such table: users` で落ちる。
> 開発 DB を作り直したいときは `pnpm run db:dev:reset`。

## 同梱デモ: パスワードレス認証 (magic link)

メールアドレスだけでログインできる magic link 認証が組み込まれている。パスワードを持たず、
メールの所有のみで本人確認する。

### フロー

```
/login (メアド入力)
  → POST /auth/magic-link        … トークン発行 + メール送信 → /login/sent
  → メール内のリンクを開く
  → GET /auth/magic-link/callback?token=…
       … トークン検証 (use-once) → ユーザー upsert → セッション発行 (Cookie)
  → / (ログイン後ホーム。表示名・メアド + ログアウト)
```

### ローカルで試す

development ではメールは送信されず、**開発サーバーの標準出力にメール内容が JSON で出力される**
(`ConsoleMailer`)。

1. `http://localhost:5173/login` を開き、メアドを入力して送信
2. dev サーバーのログに出る `{"kind":"mail", … "body":"…http://localhost:5173/auth/magic-link/callback?token=…"}`
   のリンクをブラウザで開く
3. ログイン完了し `/` にリダイレクトされる

### 関連ファイル (レイヤーをまたぐ実装例として読むとよい)

| レイヤー                    | ファイル                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ドメイン (ポート定義)       | `domain/auth/` (`IMailer`, magic-link トークンストア interface)、`domain/user/` (User, Email VO, CQRS repo interface) |
| インフラ (実装)             | `infra/kv/` (トークン・セッション)、`infra/mailer/` (Console / Cloudflare Email)、`infra/d1/repositories/`            |
| アプリケーションサービス    | `services/auth.service.ts` (`signInWithVerifiedEmail` が全認証方式の合流点)                                           |
| ハンドラ (Composition Root) | `handlers/auth/` (magic-link / logout / resolve-mailer)                                                               |
| ミドルウェア                | `middleware/auth.ts` (セッション検証)、`middleware/basic-auth.ts`                                                     |
| 画面                        | `frontend/pages/` (`login` / `login-sent` / `home`)                                                                   |

## ディレクトリ構造

```
app/
├── backend/                # Hono バックエンド (Clean Architecture)
│   ├── domain/             # ドメイン層 (インフラ非依存): entity / VO / repo・port interface
│   ├── infra/              # インフラ層: d1 / kv / mailer / console (domain の interface を実装)
│   ├── services/           # アプリケーションサービス (ユースケース)
│   ├── handlers/           # HTTP ハンドラ (Composition Root): api.ts / pages.ts / auth/
│   ├── middleware/         # 認証 / BASIC 認証 / locale
│   └── index.ts            # Hono アプリ (default export, wrangler の main)
├── frontend/               # Inertia + React フロントエンド
│   ├── pages/              # Inertia ページ (kebab-case, c.render('home') と対応)
│   ├── layouts/            # 共通レイアウト
│   ├── entry.client.tsx    # createInertiaApp (クライアント)
│   ├── entry.server.tsx    # createInertiaApp (SSR, renderToString)
│   ├── root-view.tsx       # @hono/inertia の rootView (HTML シェル)
│   └── app.css             # Tailwind + daisyUI エントリ
└── lib/                    # フロント・バック共通 (i18n リソース / constants)

migrations/                 # Drizzle 生成済みマイグレーション
docs/adr/                   # Architecture Decision Records (設計判断の記録)
.claude/rules/              # プロジェクト規約 (CLAUDE.md が読み込む)
```

Cloudflare Worker のエントリポイントは `app/backend/index.ts` の Hono インスタンスそのもの
(default export)。`wrangler.jsonc` の `main` に直接指定している。

## 使い方レシピ

### Inertia.js のページを追加する

1. `app/frontend/pages/<name>.tsx` (kebab-case) にコンポーネントを default export で追加
   ```tsx
   export default function About(props: { message: string }) {
     return <main>{props.message}</main>;
   }
   ```
2. ハンドラからレンダリング (ページ名はファイル名そのもの)
   ```ts
   router.get("/about", (c) => c.render("about", { message: "Hi" }));
   ```
3. `@hono/inertia/vite` が `app/frontend/pages.gen.ts` を再生成し、`c.render` の第 1 引数を
   型レベルで補完する。サブディレクトリは `users/index.tsx` のように切り `c.render('users/index', …)`。

### ドメイン機能を追加する (CQRS + VO)

1. `domain/<集約>/` に entity・Value Object (`*.vo.ts`)・リポジトリ interface を定義
   (Command / Query を分割)。技術名 (D1 / KV 等) は持ち込まない。
2. `infra/<技術>/` で interface を実装する。
3. `services/` にユースケースを書き、ハンドラ (Composition Root) で infra を生成して注入する。
4. HTTP ステータスへのマッピングはハンドラ層のみ。詳細は
   [.claude/rules/architecture.md](.claude/rules/architecture.md)。

### メール送信 (環境別 Mailer)

`handlers/auth/resolve-mailer.ts` の `resolveMailer(env)` が `APP_ENV` で実装を切り替える。
development は `ConsoleMailer`、staging / production は Cloudflare Email Routing の
`CloudflareEmailMailer`。本番系では送信元 (`MAIL_FROM_ADDRESS`) 未設定なら fail-loud で落ちる
(Console に静かにフォールバックしない)。

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

| 環境        | トリガー          | 用途                      | メール送信       |
| ----------- | ----------------- | ------------------------- | ---------------- |
| development | `pnpm dev`        | ローカル開発              | ConsoleMailer    |
| staging     | PR / push to main | 検証環境 (BASIC 認証付き) | Cloudflare Email |
| production  | GitHub Release    | 本番環境                  | Cloudflare Email |

- ビルド時に `CLOUDFLARE_ENV=staging|production pnpm run build` で環境を切り替える。
- staging / production でメール送信を使うには、Cloudflare Email Routing で送信元ドメインを
  検証し、`MAIL_FROM_ADDRESS` (var / secret) を設定する。
- production は `pnpm run release` → GitHub Release 公開 → `deploy-production.yml` で自動デプロイ。

> ⚠️ ステージング環境の BASIC 認証 (`middleware/basic-auth.ts`) は削除しないこと。
> `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` が設定されている場合のみ有効化される。

## アーキテクチャと規約

設計方針・規約・運用ルールはリポジトリにドキュメント化されている。

- [CLAUDE.md](CLAUDE.md) — 規約の入口 (`.claude/rules/*` を読み込む)
- [.claude/rules/architecture.md](.claude/rules/architecture.md) — 設計思想・レイヤー・命名・配置ルール
- [.claude/rules/environments.md](.claude/rules/environments.md) — 環境構成・メール・BASIC 認証
- [docs/adr/](docs/adr/) — アーキテクチャ決定の記録 (ADR)

## License

MIT
