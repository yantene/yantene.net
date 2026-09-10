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
pnpm exec wrangler secret put REFRESH_SECRET --env production  # 同期エンドポイントの保護
```

`REFRESH_SECRET` が無いと `POST /api/v1/refresh` を叩けず、**記事が 1 件も入らないまま
公開される**。

正本の読み取りに要る secret は `CONTENT_SOURCE` (wrangler.jsonc の vars) がどちらを
指すかで変わる ([ADR 0034](../../docs/adr/0034-artifacts-as-content-source-of-truth.md))。

`artifacts` の環境。

```bash
pnpm exec wrangler secret put ARTIFACTS_ACCOUNT_ID --env production
pnpm exec wrangler secret put ARTIFACTS_API_TOKEN --env production
```

`ARTIFACTS_API_TOKEN` は**ダッシュボードの API Tokens で作る**。権限は
**Account / Artifacts / Read** の 1 つだけにすること。書き込みの権限は要らないし、
持たせると Worker が漏れたときに正本を消せる。wrangler の OAuth トークンを流用しないこと
(スコープが広すぎる)。

`github` の環境。正本のリポジトリ側からも refresh を叩けるようにする (staging とは
別の値にすること)。

```bash
pnpm exec wrangler secret put GITHUB_TOKEN --env production
gh secret set PRODUCTION_REFRESH_SECRET -R yantene/notes
```

### 1'. Artifacts のリポジトリを用意する

`CONTENT_SOURCE` が `artifacts` を指す環境で要る。namespace と repo の名前は
wrangler.jsonc の vars (`ARTIFACTS_NAMESPACE` / `ARTIFACTS_REPO`) が指している。

**namespace を作るコマンドは wrangler に無い** ので REST を叩く。トークンは
Artifacts > Edit を持つ API トークン。

```bash
export ACCOUNT_ID=<account-id> CF_TOKEN=<artifacts-edit-token>
curl -sS -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/artifacts/namespaces" \
  -H "Authorization: Bearer $CF_TOKEN" -H 'Content-Type: application/json' \
  -d '{"namespace":"yantene"}'
```

repo とトークンは wrangler で足りる。

```bash
pnpm exec wrangler artifacts repos create notes --namespace yantene --default-branch main
pnpm exec wrangler artifacts repos issue-token notes --namespace yantene \
  --scope write --ttl 31536000   # TTL は秒。最長 1 年
```

repo の remote は `https://<account-id>.artifacts.cloudflare.net/git/yantene/notes.git`。
**書き手の push はここへ。** トークンは URL に埋めず、ヘッダで渡す。

```bash
git -c http.extraHeader="Authorization: Bearer <token>" \
  push <remote> main staging
```

毎回 `-c` を打ちたくなければ、git 標準の credential helper に食わせる (Artifacts は
Basic 認証も受けるので、`?expires=` を落とした値をパスワード欄に入れる)。

```bash
printf 'protocol=https\nhost=%s.artifacts.cloudflare.net\nusername=x\npassword=%s\n' \
  "<account-id>" "${TOKEN%%\?expires=*}" | git credential approve
```

GitHub からの取り込みは公開リポジトリしか受けないので、private の `yantene/notes` は
手元の clone から push して移す。

⚠️ **トークンは必ず期限が切れる (最長 1 年)。** 切れたら `issue-token` で取り直す。

### 2. KV namespace を作る

読み手のセッション (ADR 0011) を置く先。作って、返ってきた id を `wrangler.jsonc` の
該当環境の `kv_namespaces` に書く。

```bash
pnpm exec wrangler kv namespace create yantene-production-sessions
```

無いとデプロイが `SESSIONS` を解決できずに失敗する。

### 3. R2 に OG 画像用のフォントを置く

OG カードの描画は R2 上のフォント (`og/fonts/*.ttf`) を読む。refresh が同期するのは
記事の本文とアセットだけなので、フォントは手で置く。

```bash
pnpm exec wrangler r2 object get yantene-staging/og/fonts/noto-sans-jp-700-full.ttf \
  --file font.ttf --remote
pnpm exec wrangler r2 object put yantene-production/og/fonts/noto-sans-jp-700-full.ttf \
  --file font.ttf --content-type font/ttf --remote
```

無いと `/og/*` が 500 になる (`og.handler.ts` が fail-loud で throw する)。豆腐の画像を
黙って返すよりよいが、スモークまで気づかない。

### 4. コンテンツを投入する

`CONTENT_SOURCE` が `github` の環境は、`yantene/notes` の refresh ワークフローを対象
ブランチで実行する (main → production、staging → staging)。

`artifacts` の環境は、対象ブランチを Artifacts へ push したあと refresh を手で叩く
(GitHub Actions は Artifacts の push を知らない)。

```bash
curl -X POST "https://yantene.net/api/v1/refresh" -H "X-Refresh-Token: <secret>"
```

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
