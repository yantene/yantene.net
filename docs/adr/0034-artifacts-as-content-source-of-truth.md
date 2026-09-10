# 0034. コンテンツリポジトリを Cloudflare Artifacts に置き、REST API で読む

- Status: Proposed
- Date: 2026-09-11
- Deciders: @yantene

## Context / 背景

記事 (Markdown + 画像) をどこに置き、refresh がどう読むかを決める。要件は
[0004](0004-github-as-content-source-of-truth.md) と同じで、次の通り。

- 手元で Markdown を書いて `git push` するだけで反映されるワークフロー。管理画面は作らない
- Workers からそのファイルを読めること。配信 (一覧・詳細・画像) はそのレイテンシや
  レート制限に引きずられないこと
- バージョン管理があること

このサイトは Cloudflare Workers + D1 + R2 + KV + Workers AI で組んであり、コンテンツだけが
Cloudflare の外 (GitHub) にある。Cloudflare Artifacts は Git 互換のリポジトリを
Durable Objects の上に置く製品で、標準の Git クライアントで push でき、REST API と Workers
binding からも読める。これでコンテンツも Cloudflare に閉じられる。

読み取りの手段には制約がある。

- Workers binding (`env.ARTIFACTS`) はリポジトリ管理とトークン発行が主で、**中身を読む
  メソッドが 1 つも無い**。binding は `create` / `get` / `import` / `list` / `delete`、
  リポジトリのハンドルは `createToken` / `listTokens` / `revokeToken` / `fork` だけ
  (wrangler 4.131 が生成する型で確認)。ファイルはおろかツリーもコミットも読めない
- REST API はツリー・コミット・ファイルを読める。認証は Cloudflare API トークンで、
  リポジトリトークン (git 用) では REST を叩けない。文書がそう分けている
- push を購読するイベント (`cf.artifacts.repo.pushed`) と、それで Workflow を起こす
  `triggers.events` があるが、後者は wrangler 4.129 以降の設定項目で、本リポジトリの
  wrangler はまだそれより古い

## 検討した選択肢

- **案 A: GitHub リポジトリのまま** — Cloudflare の外に置き続ける。
  - Pros: 枯れている。Web エディタがある。GitHub Actions が push で refresh を叩ける
  - Cons: コンテンツだけが外にある。refresh の起動に GitHub 側の secret とワークフローが要り、
    設定が 2 つのリポジトリにまたがる
- **案 B: Artifacts に置き、REST API を Cloudflare API トークンで読む (採用)** —
  refresh のときだけ REST でツリーとファイルを読む。
  - Pros: コンテンツも Cloudflare に閉じる。読み取り経路が 1 つ (REST) で、文書と OpenAPI に
    形が書いてある。API トークンは Artifacts > Read だけに絞れる
  - Cons: 製品はまだ beta。Worker に API トークンを常駐させる (ただし読み取り専用・
    Artifacts 限定)。Web エディタが無い
- **案 C: binding で read トークンを発行し、それで REST を読む** — アカウントの API
  トークンを持たずに済ませる。短命・読み取り専用・リポジトリ限定のトークンで REST を
  叩けるなら、案 B より権限が狭くなる。
  - Cons: **リポジトリトークンは REST の認証にならない (実測)。** 成立しない

## 決定

案 B を採る。

- **置き場は Cloudflare Artifacts のリポジトリ。** namespace は `yantene`、repo は環境ごとに
  `yantene-production` / `yantene-staging` (D1 や R2 と同じ命名)。`articles/<slug>.md` が本文、
  `articles/<slug>/<filename>` が画像アセット
- **環境はリポジトリで分け、ブランチでは分けない。** 長生きするブランチはどちらも `main` だけ。
  push の購読は 1 リポジトリに 1 つしか張れないので ([0035](0035-refresh-on-push-through-a-queue.md))、
  1 つのリポジトリを両環境から自動で同期できない。かつて GitHub 側に置いていた `staging`
  ブランチは、GitHub Actions が `push` でしか refresh を起こせないための置き場で、記事を
  本番へ出す前に staging サイトで見るために使っていた。公開前の記事は本番へ出したうえで
  隠す方針に変えるので、その役目は無くなる
- **D1 はメタデータの索引、R2 は原文・MDAST・画像の写し。** 通常のリクエストは D1 + R2
  だけで捌き、コンテンツリポジトリに触るのは `POST /api/v1/refresh` のときだけ。ここは 0004 から変えない
- **読み取りは REST API だけ。** infra の `ArtifactsContentStore` が
  `IContentStore` (`listTree` / `readFile`) を実装する
  - `listTree`: `log?ref=<branch>&limit=1` で先頭コミットの tree ハッシュを取り、
    `tree/:hash` をディレクトリごとに辿って全ファイルの `{ path, hash }` を集める。
    ブランチの先端は動くので `log` は `cache: "no-store"` で読む。ハッシュで引くツリーは不変
  - `readFile`: `file?ref=<branch>&path=<path>` で生バイト列を受ける。404 は `undefined`
  - 分割された応答 (`result_info` に次のページがある) と、コミットの無いブランチは throw する。
    欠けたツリーを完全なものとして返すと、欠けた分が「消えた記事」になる (fail-loud)
- **変更検出は git の blob ハッシュ (SHA-1)。** GitHub の tree API が返す `sha` と同じ値
  なので、コンテンツリポジトリを移しても D1 の contentHash は一致し、全記事の再処理は走らない
- **認証は Cloudflare API トークン。** 権限は Artifacts > Read だけに絞り、secret
  (`ARTIFACTS_API_TOKEN`) で与える。アカウント ID も secret (`ARTIFACTS_ACCOUNT_ID`)。
  namespace / repo / branch は wrangler の vars。**未設定なら静かに劣化させず throw する**
- **どのコンテンツリポジトリを読むかは var `CONTENT_SOURCE` で環境ごとに決める** (`artifacts` / `github`)。
  production を切り替えるまでの間、`GitHubContentStore` を残して選べるようにする。
  値が無いか知らない値なら throw する。secret の有無で黙って切り替えることはしない
- **Workers binding (`artifacts`) は付けない。** 読み取りに要らず、アカウントで Artifacts が
  有効でないとデプロイ自体が通らなくなる。binding を要する機能 (push イベント、Worker
  からの書き込み) を足すときに付ける
- **書き手の push は標準の Git。** リポジトリスコープの write トークン (TTL は最長 1 年) を
  発行し、`http.extraHeader` か credential helper で持つ。手順は environments.md に置く

beta を受け入れる理由: 中身は素の Git なので、製品が変わってもコンテンツリポジトリは手元の clone に残り、
撤退は `git clone` 1 回で済む。読み手の経路は D1 + R2 で閉じているので、Artifacts の不調は
refresh が止まるだけで、配信には届かない。

### 実測して確かめたこと

上の 3 つの経路は、namespace と repo を作ってコンテンツリポジトリを push したうえで実際に叩いて確かめた。

- `log?ref=main&limit=1` の `result` は配列で、各要素が `hash` と `treeHash` を持つ。
  **並びは新しい順**で、`limit=3` の 3 件が手元の `git log -3` と完全に一致した。
  `result[0]` を先端として読んでよい (古い順だったら最初のコミットのツリーを完全な姿と
  見なし、以後に足した記事をすべて「消えた」と判定してしまう)
- `tree/:hash` の `result` は `{ name, mode, hash, type }` の配列。`type` は
  `tree` / `blob` / `exec` / `symlink` / `gitlink`
- `file?ref=&path=` は生バイト列を 200 で返し、無いパスは 404
- **blob ハッシュは手元の `git rev-parse` と一致した。** 変更検出が引き継がれる裏付けになる
- **リポジトリトークンで REST を叩くと 401 になる** (`{"code":10000,"message":"Authentication
  error"}`)。`issue-token --scope read` で出したトークンを `Authorization: Bearer` に載せ、
  `?expires=` を付けた形と落とした形の両方で試して同じ。git の remote に対しては同じ
  トークンが通るので、**トークンの種類ごとに通る面が分かれている**。案 C が成立しない
  裏付けで、Worker に置くトークンをこれ以上狭められないことを意味する
- ルート (9 件) と `articles/` (83 件) のどちらも `result_info` が付かなかった。
  この規模ではツリーの分割は起きない。分割されたら throw する作りは、想定外を静かに
  握り潰さないための保険として残す

ツリーはディレクトリごとに 1 リクエストで辿るので、記事 56 本のいまで 30 回ほどの
サブリクエストになる (GitHub の `?recursive=1` は 1 回で済んでいた)。Workers Paid の
上限 (1,000) には遠いが、記事が増えれば線形に増える。

## 帰結 / Consequences

- 良い面: コンテンツまで Cloudflare に閉じる。`git push` のワークフローは変わらない。読み取り経路が
  1 つになり、形が OpenAPI で確定している。変更検出のハッシュが引き継がれる
- 悪い面・トレードオフ: beta への依存。GitHub の Web エディタが無くなり、手元に clone が
  無い場所から直せない。push から refresh までが自動で繋がっていない (GitHub Actions は
  Artifacts の push を知らない) ので、当面は push のあと `POST /api/v1/refresh` を手で叩く。
  Worker に API トークンを常駐させる (読み取り専用・Artifacts 限定)
- 移行中の状態: `CONTENT_SOURCE` は 3 環境とも `github` で出す。staging の secret
  (`ARTIFACTS_ACCOUNT_ID` / `ARTIFACTS_API_TOKEN`) を置いてから staging を `artifacts` に
  切り替え、実 API と突き合わせてから production を切り替える。GitHub を落とすのはその後
- 検証方法: `artifacts-content-store.test.ts` が fetch モックでツリーの辿り方・ファイル読み取り・
  分割応答と空ブランチの拒否・トークンの使い回しを固定する。`resolve-content-store.test.ts`
  が `CONTENT_SOURCE` の切り替えと、secret 欠落・未知の値での throw を固定する

## 参考 / More Information

- 実装: `app/backend/infra/artifacts/artifacts-content-store.ts` /
  `app/backend/handlers/articles/resolve-content-store.ts`
- [0003](0003-clean-architecture-and-cqrs.md) /
  [0004](0004-github-as-content-source-of-truth.md) (いまのコンテンツリポジトリ。production を
  切り替えたときに Deprecated にする)
- [#401](https://github.com/yantene/yantene.net/issues/401)
- [Cloudflare Artifacts REST API](https://developers.cloudflare.com/artifacts/api/rest-api/) /
  [Authentication](https://developers.cloudflare.com/artifacts/guides/authentication/) /
  [Git protocol](https://developers.cloudflare.com/artifacts/api/git-protocol/)
