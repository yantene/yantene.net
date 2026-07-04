# CI/CD 構成

## ワークフロー一覧

| ワークフロー            | トリガー                     | 内容                                              |
| ----------------------- | ---------------------------- | ------------------------------------------------- |
| `pull-request.yml`      | PR open/edit/sync            | ブランチ名・PR タイトルのフォーマット検証         |
| `lint.yml`              | PR to main / `workflow_call` | Prettier・ESLint・TypeScript・wrangler.jsonc 検証 |
| `test.yml`              | PR to main                   | Vitest 実行                                       |
| `deploy-preview.yml`    | PR to main                   | staging へ preview デプロイ                       |
| `deploy-staging.yml`    | push to main                 | staging 自動デプロイ                              |
| `deploy-production.yml` | GitHub Release published     | production デプロイ                               |

## PR で走るチェック

PR を main にマージする前に、以下のチェックがすべて pass していることを確認する。

| チェック名        | ワークフロー         | 内容                                       |
| ----------------- | -------------------- | ------------------------------------------ |
| `format`          | `lint.yml`           | Prettier フォーマットチェック              |
| `eslint`          | `lint.yml`           | ESLint 静的解析                            |
| `typecheck`       | `lint.yml`           | TypeScript 型チェック                      |
| `wrangler-config` | `lint.yml`           | 全環境の `wrangler deploy --dry-run` 検証  |
| `migration-check` | `lint.yml`           | マイグレーションとスキーマの整合性チェック |
| `storybook`       | `lint.yml`           | Storybook ビルド                           |
| `check-title`     | `pull-request.yml`   | PR タイトルの Conventional Commits 準拠    |
| `check-branch`    | `pull-request.yml`   | ブランチ名の命名規則準拠                   |
| `test`            | `test.yml`           | Vitest テストスイート                      |
| `deploy`          | `deploy-preview.yml` | staging preview デプロイ                   |

**マージ判断基準: 上記が全て pass であること。** 一部ジョブが失敗した状態でのマージは禁止。

> ⚠️ 現状 GitHub 側のブランチ保護ルール・Ruleset は未設定のため、上記は CI 上で走るだけで
> マージが機械的にブロックされるわけではない。当面は手動で全チェック pass を確認してから
> マージすること。恒久的な担保として、将来的に `main` へブランチ保護 / Ruleset
> (必須ステータスチェック・squash merge・レビュースレッド resolve 必須) を設定するのが望ましい。

## Composite Action

`actions/setup` は pnpm + Node.js + 依存関係インストールを行う。
型定義生成 (`wrangler types`) は `package.json` の `postinstall` フックで
`pnpm install` 時に走るため、各ジョブで明示的に呼ぶ必要はない。

## Secrets

- GitHub Actions: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Cloudflare Workers (staging): `BASIC_AUTH_USER`, `BASIC_AUTH_PASS` (削除禁止)
