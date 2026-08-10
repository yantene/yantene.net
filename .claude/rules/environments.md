# 環境構成

| 環境        | トリガー          | URL                                            | DB                          |
| ----------- | ----------------- | ---------------------------------------------- | --------------------------- |
| development | ローカル          | localhost                                      | yantene-development (local) |
| staging     | PR / push to main | https://staging.yantene.net                    | yantene-staging             |
| production  | GitHub Release    | https://yantene-production.yantene.workers.dev | yantene-production          |

staging は workers.dev (`yantene-staging.yantene.workers.dev`) からも引ける。PR ごとの
preview デプロイがプレビュー URL を workers.dev 上に作るため、両方を有効にしている。

production は当面 workers.dev で動かす。`yantene.net` は今も旧サイト (GitHub Pages) を
向いており、カスタムドメインを設定すると「デプロイした瞬間が本番公開」になって事前確認の
余地が無いため。中身を確認したうえで切り替える ([#130](https://github.com/yantene/yantene.net/issues/130))。

> ⚠️ production は BASIC 認証を持たないため `robots.txt` は `Allow: /` を返し、sitemap も
> 公開される。workers.dev で暫定運用している間に検索エンジンへ載ると、独自ドメインへ
> 移したときに重複コンテンツになる。切り替えまでが長引くなら手を打つこと。

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

## 環境を新しく作るときの手作業

**デプロイだけでは動かない。** バインディング (D1 / R2) は `wrangler.jsonc` が持つが、
secret と R2 の中身はリポジトリの外にあるため、環境ごとに人が用意する必要がある。
以下は production を例にした手順で、作り直すときも同じことが要る。

### 1. secret を設定する

```bash
pnpm exec wrangler secret put GITHUB_TOKEN --env production    # コンテンツ正本の読み取り
pnpm exec wrangler secret put REFRESH_SECRET --env production  # 同期エンドポイントの保護
```

コンテンツ正本のリポジトリ側からも叩けるようにする。staging とは別の値にすること。

```bash
gh secret set PRODUCTION_REFRESH_SECRET -R yantene/notes
```

`REFRESH_SECRET` が無いと `POST /api/v1/refresh` を叩けず、**記事が 1 件も入らないまま
公開される**。

### 2. R2 に OG 画像用のフォントを置く

OG カードの描画は R2 上のフォント (`og/fonts/*.ttf`) を読む。refresh が同期するのは
ノートの本文とアセットだけなので、フォントは手で置く。

```bash
pnpm exec wrangler r2 object get yantene-staging/og/fonts/noto-sans-jp-700-full.ttf \
  --file font.ttf --remote
pnpm exec wrangler r2 object put yantene-production/og/fonts/noto-sans-jp-700-full.ttf \
  --file font.ttf --content-type font/ttf --remote
```

無いと `/og/*` が 500 になる (`og.handler.ts` が fail-loud で throw する)。豆腐の画像を
黙って返すよりよいが、スモークまで気づかない。

### 3. コンテンツを投入する

`yantene/notes` の refresh ワークフローを対象ブランチで実行する (main → production、
staging → staging)。

### 4. スモークで確かめる

```bash
SMOKE_BASE=https://yantene-production.yantene.workers.dev pnpm run smoke
```

1 と 2 の抜けはここで 500 として出る。

## リリースフロー

`pnpm run release` で `scripts/release.sh` が以下を実行する。

1. タグ名を `v<YYYY.MM.DD>.<SEQ>` 形式で自動決定 (同日複数リリース対応)
2. git タグを作成・push
3. `gh release create` で GitHub Release を公開 (リリースノートは自動生成)

Release が公開されると `deploy-production.yml` が自動起動し production にデプロイされる。

## wrangler.jsonc の注意点

- カスタムドメインは `routes` + `custom_domain: true` で指定する
- CI で `pnpm run wrangler:check` (`scripts/check-wrangler.sh`) により全環境を検証する。
  各環境でビルドし、生成された `build/server/wrangler.json` に対して
  `wrangler deploy --dry-run` を実行する。`wrangler.jsonc` の main を直接 dry-run すると
  React Router の `virtual:react-router/server-build` を解決できず失敗するため

## ルール・設定の遵守

リポジトリに設定されたルールや制約を勝手にバイパス・無効化・緩和してはならない。

以下の行為は明示的な許可がない限り禁止。

- `gh pr merge --admin` 等でブランチ保護をバイパスしてマージする
- CI ワークフローのチェック内容を緩和・スキップする
- ESLint 設定のルールを緩和・無効化する
- TypeScript の `strict` オプションを緩める、`any` を安易に使う
- `eslint-disable` コメントで警告やエラーを握りつぶす (正当な理由がある場合を除く)

ルールによってブロックされた場合は、ルールに従う方法を探すか、ユーザーに相談すること。
