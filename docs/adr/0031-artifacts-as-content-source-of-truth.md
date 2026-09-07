# 0031. コンテンツの正本を Cloudflare Artifacts に置き、REST API で読む

- Status: Accepted
- Date: 2026-09-07
- Deciders: @yantene

## Context / 背景

ノート (Markdown + 画像) の正本をどこに置き、refresh がどう読むかを決める。要件は
[0004](0004-github-as-content-source-of-truth.md) と同じで、次の通り。

- 手元で Markdown を書いて `git push` するだけで反映されるワークフロー。管理画面は作らない
- Workers から正本のファイルを読めること。配信 (一覧・詳細・画像) は正本のレイテンシや
  レート制限に引きずられないこと
- バージョン管理があること

このサイトは Cloudflare Workers + D1 + R2 + KV + Workers AI で組んであり、正本だけが
Cloudflare の外 (GitHub) にあった。Cloudflare Artifacts は Git 互換のリポジトリを
Durable Objects の上に置く製品で、標準の Git クライアントで push でき、REST API と Workers
binding からも読める。これで正本も Cloudflare に閉じられる。

読み取りの手段には制約がある。

- Workers binding (`env.ARTIFACTS`) はリポジトリ管理とトークン発行が主で、**ファイルの
  中身を読むメソッドが無い**。ツリーやコミットを読むメソッドは文書にあるが、wrangler が
  生成する型 (4.129 時点) には無い
- REST API はツリー・コミット・ファイルを読める。認証は Cloudflare API トークンで、
  リポジトリトークン (git 用) では REST を叩けない。文書がそう分けている
- push を購読するイベント (`cf.artifacts.repo.pushed`) と、それで Workflow を起こす
  `triggers.events` があるが、後者は wrangler 4.129 以降の設定項目で、本リポジトリの
  wrangler はまだそれより古い

## 検討した選択肢

- **案 A: GitHub リポジトリのまま** — 正本を Cloudflare の外に置き続ける。
  - Pros: 枯れている。Web エディタがある。GitHub Actions が push で refresh を叩ける。
  - Cons: 正本だけが外にある。refresh の起動に GitHub 側の secret とワークフローが要り、
    設定が 2 つのリポジトリにまたがる。
- **案 B: Artifacts を正本にし、REST API を Cloudflare API トークンで読む (採用)** —
  refresh のときだけ REST でツリーとファイルを読む。
  - Pros: 正本が Cloudflare に閉じる。読み取り経路が 1 つ (REST) で、文書と OpenAPI に
    形が書いてある。API トークンは Artifacts > Read だけに絞れる。
  - Cons: 製品はまだ beta。Worker に API トークンを常駐させる (ただし読み取り専用・
    Artifacts 限定)。Web エディタが無い。
- **案 C: binding で read トークンを発行し、それで REST を読む** — アカウントの API
  トークンを持たずに済ませる。
  - Cons: リポジトリトークンは git 操作用で、REST の認証にならない (文書が明記)。
    binding だけで完結させようにも、中身を読む口が無い。成立しない。

## 決定

案 B を採る。

- **正本は Cloudflare Artifacts のリポジトリ** (namespace `yantene`、repo `notes`)。
  `notes/<slug>.md` が本文、`notes/<slug>/<filename>` が画像アセット。staging と
  production はブランチで分ける (`staging` / `main`)
- **D1 はメタデータの索引、R2 は原文・MDAST・画像の写し。** 通常のリクエストは D1 + R2
  だけで捌き、正本に触るのは `POST /api/v1/refresh` のときだけ。ここは 0004 から変えない
- **読み取りは REST API だけ。** infra の `ArtifactsContentStore` が
  `IContentStore` (`listTree` / `readFile`) を実装する
  - `listTree`: `log?ref=<branch>&limit=1` で先頭コミットの tree ハッシュを取り、
    `tree/:hash` をディレクトリごとに辿って全ファイルの `{ path, hash }` を集める。
    ブランチの先端は動くので `log` は `cache: "no-store"` で読む。ハッシュで引くツリーは不変
  - `readFile`: `file?ref=<branch>&path=<path>` で生バイト列を受ける。404 は `undefined`
  - 分割された応答 (`result_info` に次のページがある) と、コミットの無いブランチは throw する。
    欠けたツリーを完全なものとして返すと、欠けた分が「消えたノート」になる (fail-loud)
- **変更検出は git の blob ハッシュ (SHA-1)。** GitHub の tree API が返す `sha` と同じ値
  なので、正本を移しても D1 の contentHash は一致し、全記事の再処理は走らない
- **認証は Cloudflare API トークン。** 権限は Artifacts > Read だけに絞り、secret
  (`ARTIFACTS_API_TOKEN`) で与える。アカウント ID も secret (`ARTIFACTS_ACCOUNT_ID`)。
  namespace / repo / branch は wrangler の vars。**未設定なら静かに劣化させず throw する**
- **どの正本を読むかは var `CONTENT_SOURCE` で環境ごとに決める** (`artifacts` / `github`)。
  production を切り替えるまでの間、`GitHubContentStore` を残して選べるようにする。
  値が無いか知らない値なら throw する。secret の有無で黙って切り替えることはしない
- **Workers binding (`artifacts`) は付けない。** 読み取りに要らず、アカウントで Artifacts が
  有効でないとデプロイ自体が通らなくなる。binding を要する機能 (push イベント、Worker
  からの書き込み) を足すときに付ける
- **書き手の push は標準の Git。** リポジトリスコープの write トークン (TTL は最長 1 年) を
  発行し、`http.extraHeader` か credential helper で持つ。手順は environments.md に置く

beta を受け入れる理由: 中身は素の Git なので、製品が変わっても正本は手元の clone に残り、
撤退は `git clone` 1 回で済む。読み手の経路は D1 + R2 で閉じているので、Artifacts の不調は
refresh が止まるだけで、配信には届かない。

## 帰結 / Consequences

- 良い面: 正本まで Cloudflare に閉じる。`git push` のワークフローは変わらない。読み取り経路が
  1 つになり、形が OpenAPI で確定している。変更検出のハッシュが引き継がれる
- 悪い面・トレードオフ: beta への依存。GitHub の Web エディタが無くなり、手元に clone が
  無い場所から直せない。push から refresh までが自動で繋がっていない (GitHub Actions は
  Artifacts の push を知らない) ので、当面は push のあと `POST /api/v1/refresh` を手で叩く。
  Worker に API トークンを常駐させる (読み取り専用・Artifacts 限定)
- 検証方法: `artifacts-content-store.test.ts` が fetch モックでツリーの辿り方・ファイル読み取り・
  分割応答と空ブランチの拒否・トークンの使い回しを固定する。`resolve-content-store.test.ts`
  が `CONTENT_SOURCE` の切り替えと、secret 欠落・未知の値での throw を固定する。実 API との
  突き合わせは staging で行う (`CONTENT_SOURCE` を先に staging だけ `artifacts` にしてある)

## 参考 / More Information

- 実装: `app/backend/infra/artifacts/artifacts-content-store.ts` /
  `app/backend/handlers/notes/resolve-content-store.ts`
- [0003](0003-clean-architecture-and-cqrs.md) / [0004](0004-github-as-content-source-of-truth.md)
  (Deprecated。D1 / R2 を写しにする骨子と変更検出の設計はここへ引き継いだ)
- [#401](https://github.com/yantene/yantene.net/issues/401)
- [Cloudflare Artifacts REST API](https://developers.cloudflare.com/artifacts/api/rest-api/) /
  [Authentication](https://developers.cloudflare.com/artifacts/guides/authentication/) /
  [Git protocol](https://developers.cloudflare.com/artifacts/api/git-protocol/)
