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

コンテンツリポジトリ (Cloudflare Artifacts) の読み取りに要る secret
([ADR 0034](../../docs/adr/0034-artifacts-as-content-source-of-truth.md))。

```bash
pnpm exec wrangler secret put ARTIFACTS_ACCOUNT_ID --env production
pnpm exec wrangler secret put ARTIFACTS_API_TOKEN --env production
```

`ARTIFACTS_API_TOKEN` は**ダッシュボードの API Tokens で作る**。権限は
**Account / Artifacts / Read** の 1 つだけにすること。書き込みの権限は要らないし、
持たせると Worker が漏れたときにコンテンツリポジトリを消せる。wrangler の OAuth トークンを流用しないこと
(スコープが広すぎる)。

権限はアカウント単位なので、**1 本を全環境で使い回してよい**。読み取り専用で、読める中身は
公開されているサイトそのものなので、環境ごとに分ける実益が無い。

⚠️ **最新バージョンが配信中でないと secret を編集できない** (`code: 10215`)。PR の
preview デプロイは staging の Worker に**バージョンだけ上げて配信はしない**ので、PR が
開いている間、staging の secret の追加・削除はこれで弾かれる。main のデプロイが走った
直後の窓で叩くか、ダッシュボードから触ること。production には preview が飛ばないので
この問題は出ない。

手元 (development) も同じ 2 つが要る。`.dev.vars.example` を `.dev.vars` に写して埋める。
手元の作業ツリーを読めるようにしてこれを不要にするのは
[#461](https://github.com/yantene/yantene.net/issues/461)。

管理者の最初の passkey を登録するのに要る secret
([ADR 0036](../../docs/adr/0036-authenticate-admin-with-passkey.md))。

```bash
pnpm exec wrangler secret put ADMIN_REGISTRATION_TOKEN --env production
```

値は長い乱数にする (`openssl rand -base64 32`)。**置かないと bootstrap の経路が閉じる**
(`/admin` の登録が 404 になる。fail-loud)。

登録済みの passkey が 1 本でもあれば、追加の登録はサインインが条件になるのでこの値は
見ない。**それでも消さないこと。** 端末をすべて失って表を空にしたとき、復旧に再び要る。

```bash
pnpm exec wrangler d1 execute yantene-production --env production --remote --command \
  "DELETE FROM admin_credentials;"
```

⚠️ **passkey は環境ごとに登録する。** `yantene.net` / `staging.yantene.net` /
`localhost` は WebAuthn から見て別の RP なので、手元で登録した passkey で production に
入ることはできない。揃えようとして RP ID を親ドメインに広げないこと (署名が効く範囲が
必要以上に広がる)。

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

repo とトークンは wrangler で足りる。**リポジトリは環境ごとに 1 つ**で、名前は D1 や R2 と
同じ `yantene-<環境>` にする (push の購読が 1 リポジトリに 1 つしか張れないため。ADR 0035)。

```bash
pnpm exec wrangler artifacts repos create yantene-production --namespace yantene --default-branch main
pnpm exec wrangler artifacts repos issue-token yantene-production --namespace yantene \
  --scope write --ttl 31536000   # TTL は秒。最長 1 年
```

repo の remote は `https://<account-id>.artifacts.cloudflare.net/git/yantene/yantene-production.git`。
**書き手の push はここへ。** トークンは URL に埋めず、ヘッダで渡す。

```bash
git -c http.extraHeader="Authorization: Bearer <token>" push <remote> main
```

毎回 `-c` を打ちたくなければ、git 標準の credential helper に食わせる (Artifacts は
Basic 認証も受けるので、`?expires=` を落とした値をパスワード欄に入れる)。

⚠️ **先に `credential.useHttpPath` を立てること。** トークンは**リポジトリ単位**の
スコープで、staging のトークンで production には push できない。既定では credential は
ホスト単位で引かれるので、2 本を続けて入れると**後から入れたほうが前のを上書きし、
片方の push が 403 で落ちる**。

```bash
git config credential.helper libsecret   # 平文で置きたくないので keyring に入れる
git config credential.useHttpPath true   # リポジトリごとに別のトークンを持たせる

printf 'protocol=https\nhost=%s.artifacts.cloudflare.net\npath=git/yantene/%s.git\nusername=x\npassword=%s\n\n' \
  "<account-id>" "<repo>" "${TOKEN%%\?expires=*}" | git credential approve
```

入れたら `git ls-remote <remote>` が `-c http.extraHeader` 無しで通ることを、
**環境ごとに**確かめる。片方だけ通るなら上書きしている。

⚠️ **トークンは必ず期限が切れる (最長 1 年)。** 切れたら `issue-token` で取り直す。

### 1''. push で同期が走るようにする

push を Queue に流し、Worker の `queue()` が受けて同期する (ADR 0035)。Queue は環境ごとに
2 つ。名前は `wrangler.jsonc` の `queues.consumers` が指している。

```bash
pnpm exec wrangler queues create yantene-production-content-events
pnpm exec wrangler queues create yantene-production-content-events-dlq
```

`-dlq` のほうは、再試行を 3 回使い切ったメッセージの行き先。ここが無いと落ちた push が
黙って消え、**push しても同期されていないことに誰も気づけない**。同じ Worker が受けて
`error` で記録に残すだけで、同期はやり直さない (次の push が最新の姿に揃えるため)。
気づく手立てはこの記録なので、見るのは Workers Logs か `wrangler tail`。

⚠️ **Queue は deploy より先に作ること。** 無いと `wrangler deploy` が consumer を
解決できずに失敗する。

購読は **wrangler では張れない** (リポジトリを指す `source.namespace` / `source.repo_name` を
渡すオプションが CLI に無い)。REST を直接叩く。`queue_id` は `wrangler queues list` で引く。

```bash
curl -sS -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/event_subscriptions/subscriptions" \
  -H "Authorization: Bearer $CF_TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "name": "yantene-production-content-pushes",
    "source": { "type": "artifacts.repo", "namespace": "yantene", "repo_name": "yantene-production" },
    "events": ["pushed"],
    "destination": { "type": "queues.queue", "queue_id": "<queue-id>" }
  }'
```

**イベント名は `pushed`。** メッセージ本体の `type` は `cf.artifacts.repo.pushed` だが、
購読を作るときに渡すのは接頭辞の無いほう。

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

その環境のリポジトリの `main` へ push すれば同期が走る (1'')。手で叩きたいとき
(実装を変えて既存の記事に反映させるとき) は force を付ける。

```bash
curl -X POST "https://yantene.net/api/v1/refresh?force=true" -H "X-Refresh-Token: <secret>"
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
