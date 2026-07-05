# 環境構成

| 環境        | トリガー          | DB                          |
| ----------- | ----------------- | --------------------------- |
| development | ローカル          | yantene-development (local) |
| staging     | PR / push to main | yantene-staging             |
| production  | GitHub Release    | yantene-production          |

ビルド時に環境を切り替える。

```bash
CLOUDFLARE_ENV=staging pnpm run build
CLOUDFLARE_ENV=production pnpm run build
```

## ステージング環境の BASIC 認証

ステージング環境には必ず BASIC 認証をかけること。これは絶対的なルールである。

- ミドルウェア: `middleware/basic-auth.ts` (conditionalBasicAuth)
- `BASIC_AUTH_USER` と `BASIC_AUTH_PASS` 環境変数が設定されている場合のみ有効化
- Cloudflare の Secrets として設定する (`wrangler secret put` または Cloudflare ダッシュボード)
- `app/backend/index.ts` で全ルートに適用
- 認証方式を変更・追加する際にも、この BASIC 認証ミドルウェアを削除してはならない

## 本番のメール送信

magic link 等のメール送信は環境ごとに実装を切り替える。解決は
`handlers/auth/resolve-mailer.ts` の `resolveMailer(env)` が担う。

- development: `ConsoleMailer` (stdout へ書き出すだけ)
- staging / production: `CloudflareEmailMailer` (Cloudflare Email Routing の Send Email バインディング)

staging / production で必要な設定:

- `wrangler.jsonc` の `send_email` バインディング (`name: EMAIL`)
- 送信元ドメインを Cloudflare Email Routing で検証する
- 送信元アドレスを `MAIL_FROM_ADDRESS` (Cloudflare の var / secret) で与える

設定不備 (バインディング未配線・`MAIL_FROM_ADDRESS` 未設定) のときは、ConsoleMailer へ
静かにフォールバックせず **fail-loud で throw** する。staging / production で console 送信は許容しない。

## リリースフロー

`pnpm run release` で `scripts/release.sh` が以下を実行する。

1. タグ名を `v<YYYY.MM.DD>.<SEQ>` 形式で自動決定 (同日複数リリース対応)
2. git タグを作成・push
3. `gh release create` で GitHub Release を公開 (リリースノートは自動生成)

Release が公開されると `deploy-production.yml` が自動起動し production にデプロイされる。

## wrangler.jsonc の注意点

- カスタムドメインは `routes` + `custom_domain: true` で指定する
- CI で `pnpm run wrangler:check` (`wrangler deploy --dry-run` を全環境で実行) により検証される

## ルール・設定の遵守

リポジトリに設定されたルールや制約を勝手にバイパス・無効化・緩和してはならない。

以下の行為は明示的な許可がない限り禁止。

- `gh pr merge --admin` 等でブランチ保護をバイパスしてマージする
- CI ワークフローのチェック内容を緩和・スキップする
- ESLint 設定のルールを緩和・無効化する
- TypeScript の `strict` オプションを緩める、`any` を安易に使う
- `eslint-disable` コメントで警告やエラーを握りつぶす (正当な理由がある場合を除く)

ルールによってブロックされた場合は、ルールに従う方法を探すか、ユーザーに相談すること。
