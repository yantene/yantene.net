# yantene.net

React Router 7 + Hono + Cloudflare Workers で構築されたやんてねの実験室です。

## セットアップ

```bash
pnpm install
```

## 開発

### 開発サーバーの起動

```bash
pnpm run dev
```

http://localhost:5173 でアクセスできます。

### データベースのセットアップ

初回、またはスキーマ変更後にマイグレーションを適用してください。

```bash
pnpm run db:dev:migrate
```

### スキーマ変更時のマイグレーション生成

```bash
pnpm run db:generate
```

### データベースのリセット

全テーブルを DROP してマイグレーションを再適用します:

```bash
pnpm run db:dev:reset
```

## テスト

```bash
pnpm run test        # ウォッチモード
pnpm run test:run    # 単発実行
```

## コード品質

```bash
pnpm run lint        # ESLint
pnpm run format      # Prettier チェック
pnpm run fix         # lint + format を自動修正
pnpm run typecheck   # TypeScript 型検査
```

## ビルド

```bash
pnpm run build
pnpm run preview     # ローカルでプロダクションビルドを確認
```

## デプロイ

```bash
pnpm run deploy                     # ビルド & デプロイ
pnpm exec wrangler versions upload   # プレビューバージョンをアップロード
pnpm exec wrangler versions deploy   # バージョンをプロモート
```

### 本番データベースのセットアップ

1. Cloudflare ダッシュボードで D1 データベース `yantene-production` を作成
2. `wrangler.jsonc` の `env.production.d1_databases[0].database_id` を更新
3. マイグレーション適用:

   ```bash
   pnpm run db:prod:migrate
   ```
