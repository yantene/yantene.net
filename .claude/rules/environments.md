# 環境構成

| 環境        | トリガー          | URL                         | DB                          |
| ----------- | ----------------- | --------------------------- | --------------------------- |
| development | ローカル          | localhost                   | yantene-development (local) |
| staging     | PR / push to main | https://staging.yantene.net | yantene-staging             |
| production  | GitHub Release    | https://yantene.net         | yantene-production          |

staging は workers.dev (`yantene-staging.yantene.workers.dev`) からも引ける。PR ごとの
preview デプロイがプレビュー URL を workers.dev 上に作るため、両方を有効にしている。

production は `workers_dev` を開かない。同じ内容が 2 つの URL で引けると、検索エンジンから
見て重複コンテンツになるため。

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

**デプロイだけでは動かない。** バインディング (D1 / R2 / KV) は `wrangler.jsonc` が持つが、
実体・secret・R2 の中身はリポジトリの外にあるため、環境ごとに人が用意する必要がある。
以下は production を例にした手順で、作り直すときも同じことが要る。

### 1. secret を設定する

```bash
pnpm exec wrangler secret put ARTIFACTS_ACCOUNT_ID --env production  # コンテンツ正本 (Artifacts) の読み取り
pnpm exec wrangler secret put ARTIFACTS_API_TOKEN --env production   # 同上。権限は Artifacts > Read だけ
pnpm exec wrangler secret put REFRESH_SECRET --env production        # 同期エンドポイントの保護
```

`ARTIFACTS_API_TOKEN` はダッシュボードの API Tokens で作る。権限は **Account / Artifacts /
Read** の 1 つだけにする。書き込みの権限は要らないし、持たせると Worker が漏れたときに正本を
消せる。

`CONTENT_SOURCE` が `github` の環境 (production の切り替え前) は代わりに `GITHUB_TOKEN` を
置き、コンテンツ正本のリポジトリ側からも refresh を叩けるようにする。

```bash
pnpm exec wrangler secret put GITHUB_TOKEN --env production
gh secret set PRODUCTION_REFRESH_SECRET -R yantene/notes   # staging とは別の値にする
```

`REFRESH_SECRET` が無いと `POST /api/v1/refresh` を叩けず、**記事が 1 件も入らないまま
公開される**。正本側の secret が無いと refresh が throw する (fail-loud)。

### 1'. Artifacts のリポジトリを用意する

namespace `yantene` と repo `notes` は `wrangler.jsonc` の vars が指している。無ければ作る。
REST は `ARTIFACTS_API_TOKEN` とは別の、**Artifacts > Edit** を持つトークンで叩く
(作るときだけ要る。Worker には置かない)。

```bash
export ACCOUNT_ID=<account-id> CLOUDFLARE_API_TOKEN=<artifacts-edit-token>
export BASE="https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/artifacts"
curl -X POST "$BASE/namespaces" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" -d '{"namespace":"yantene"}'
curl -X POST "$BASE/namespaces/yantene/repos" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" -d '{"name":"notes","default_branch":"main"}'
```

応答の `remote` (`https://<account-id>.artifacts.cloudflare.net/git/yantene/notes.git`) が
push 先。書き手の手元には write トークンを 1 本発行して持たせる。TTL は最長 1 年
(31,536,000 秒)。切れたら発行し直す。

```bash
curl -X POST "$BASE/namespaces/yantene/tokens" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" -d '{"repo":"notes","scope":"write","ttl":31536000}'
```

手元の clone に remote を足し、トークンはヘッダで渡す (URL に埋めない)。

```bash
git remote add artifacts <remote>
git config remote.artifacts.pushurl <remote>
git -c http.extraHeader="Authorization: Bearer <token>" push artifacts main staging
```

毎回 `-c` を打ちたくなければ `git config --local http.<remote>.extraHeader "Authorization: Bearer <token>"`
で remote の URL に紐付けて持つ (`.git/config` に平文で入るので、clone を共有しないこと)。
GitHub からの取り込みは公開リポジトリしか受けないので、private の `yantene/notes` は
このように手元から push して移す。

### 2. KV namespace を作る

読み手のセッション (ADR 0011) を置く先。作って、返ってきた id を `wrangler.jsonc` の
該当環境の `kv_namespaces` に書く。

```bash
pnpm exec wrangler kv namespace create yantene-production-sessions
```

無いとデプロイが `SESSIONS` を解決できずに失敗する。

### 3. R2 に OG 画像用のフォントを置く

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

### 4. コンテンツを投入する

Artifacts を読む環境は、対象ブランチを push したあと refresh を手で叩く (GitHub Actions は
Artifacts の push を知らない)。

```bash
curl -X POST "https://yantene.net/api/v1/refresh" -H "X-Refresh-Token: <secret>"
```

GitHub を読む環境 (`CONTENT_SOURCE: github`) は `yantene/notes` の refresh ワークフローを
対象ブランチで実行する (main → production、staging → staging)。

### 5. スモークで確かめる

```bash
SMOKE_BASE=https://yantene.net pnpm run smoke
```

1 と 3 の抜けはここで 500 として出る。

## リリースフロー

`pnpm run release` で `scripts/release.sh` が以下を実行する。

1. タグ名を `v<YYYY.MM.DD>.<SEQ>` 形式で自動決定 (同日複数リリース対応)
2. git タグを作成・push
3. `gh release create` で GitHub Release を公開 (リリースノートは自動生成)

Release が公開されると `deploy-production.yml` が自動起動し production にデプロイされる。

### migration は全環境で自動適用される

デプロイ系のワークフローは 3 つとも共有の `.github/workflows/deploy.yml` を呼んでいて、
そこが **その環境の D1 に migration を当ててからデプロイする**。staging と production で
非対称は無い。

| 環境       | 誰が当てるか                                           |
| ---------- | ------------------------------------------------------ |
| staging    | `deploy-preview.yml` / `deploy-staging.yml` が自動適用 |
| production | `deploy-production.yml` が Release 公開時に自動適用    |

順番も `Migrate D1` → `Deploy` で固定されているので、**列を足すだけの変更**なら
`pnpm run release` を打つだけでよい。新しいコードが列の無い DB に乗ることはない。

手で流したければ流してもよいが、要らない (冪等なので `No migrations to apply` になる)。

```bash
pnpm run db:prod:migrate   # 任意。確認のためだけなら実害は無い
pnpm run release
```

### ⚠️ 後方互換でない変更は、自動適用が先に走ることを踏まえて分ける

自動なので取り消せない。**列や表を消す migration は、それを読まなくなったコードが
production に乗る前に走る。** つまり次はリリースの瞬間に壊れる。

1. 列を消す migration と、その列を読まなくしたコードを 1 つのリリースに入れる
2. Release 公開 → **`Migrate D1` が先に走って列が消える**
3. `Deploy` はそのあと。**その数十秒、旧コードが消えた列を読み続ける**

削除・改名・NOT NULL 化のような後方互換でない変更は、リリースを 2 回に分ける。

1. 回目: コード側だけ先に出す (その列を読まなくする)。migration は入れない
2. 回目: 列を消す migration を出す

`migrations/` に破壊的な変更を含む PR は、この 2 段階のどちらなのかを PR に書くこと。

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
- Oxlint 設定 (`vite.config.ts` の `lint`) のルールを緩和・無効化する
- TypeScript の `strict` オプションを緩める、`any` を安易に使う
- `oxlint-disable` コメントで警告やエラーを握りつぶす (正当な理由がある場合を除く)

ルールによってブロックされた場合は、ルールに従う方法を探すか、ユーザーに相談すること。
