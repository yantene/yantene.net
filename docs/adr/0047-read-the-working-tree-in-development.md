# 0047. 手元では作業ツリーを Vite の dev サーバー越しに読む

- Status: Accepted
- Date: 2026-11-05
- Deciders: @yantene

## Context / 背景

コンテンツリポジトリは Cloudflare Artifacts に置き、環境ごとのリポジトリの `main` を読む
([ADR 0034](0034-artifacts-as-content-source-of-truth.md))。手元 (development) も同じ読み方を
していたので、記事の見た目を確かめるには commit して `yantene-staging` へ push するしかなかった。
期限付きの Artifacts の API トークンを `.dev.vars` に置き、切れるたびに取り直す手間もあった。

書き手が欲しいのは、**コミットする前の下書きを `pnpm dev` で見ること**である。`status: draft`
の記事も同期されるので ([ADR 0040](0040-article-status-and-reader-facing-repository.md))、手元の
作業ツリーを読めれば、管理者としてログインした画面で下書きが見える。

制約が 1 つある。**Worker (workerd) からホストのファイルは読めない。** `nodejs_compat` で
`node:fs` の import は通るが、映っているのは仮想のファイルシステムで、`readFileSync` も
`readdir` も手元のパスを見つけられない (`wrangler dev --local` で実測)。

## 検討した選択肢

- **案 A: Vite の dev サーバーに口を足し、Worker が fetch する** — `@cloudflare/vite-plugin` の
  Worker は Vite の dev サーバーの中で動く。Node で動く Vite の側が作業ツリーを読み、
  `GET /__content/tree` と `GET /__content/file` で出す。
  - Pros: `IContentStore` の実装を 1 つ足すだけで、refresh・D1・R2 は何も知らずに済む。
    Worker から `http://localhost:5173` への fetch は届く (実測)
  - Cons: `pnpm dev` (Vite) の中でしか動かない。`pnpm run preview` と `wrangler dev` には口が無い
- **案 B: 手元の bare リポジトリか小さな git サーバーを立て、Artifacts と同じ REST を真似る** —
  `ArtifactsContentStore` を向け先だけ替えて使う。
  - Pros: 読む側のコードが 1 つで済む
  - Cons: 読めるのはコミット済みの姿だけで、コミット前の下書きという目的を果たさない
- **案 C: 同期の前に作業ツリーを R2 や D1 へ写すスクリプトを手で走らせる** —
  - Pros: Worker の側は何も変えない
  - Cons: refresh の変更検出 (ツリーのハッシュと D1 の contentHash の突き合わせ) を
    スクリプトの側でもう一度作ることになる

## 決定

案 A を採る。`CONTENT_SOURCE` に `local` を足し、development の既定にする。staging と
production は `artifacts` のまま。

- 口 (`vite/content-bridge.ts`) は `apply: "serve"` で、build にも preview にも入らない
- 列挙は `git ls-files --cached --others --exclude-standard`。**push すれば載るもの**と同じ範囲で、
  コミットしていない新しい記事は入り、`.gitignore` で外したもの (`.violet/` の取材ログ) は入らない。
  作業ツリーで消したファイルは列挙から落ちる
- ハッシュは git の blob ハッシュで、Artifacts の tree が返す値と同じになる。`local` と
  `artifacts` を切り替えても、手を入れていないファイルは読み直されない
- 読ませるのは列挙に出たパスだけ。`..` で作業ツリーの外を読ませない
- **手元の機械 (loopback) からの要求にしか答えない。** `pnpm dev` は `--host 0.0.0.0` で LAN にも
  開いているので、下書きと規範を含む作業ツリーをよその端末に読ませない
- 読めないときは空のツリーではなく 500 を返し、`LocalContentStore` が throw する。空のツリーは
  refresh に「記事が全部消えた」と読まれる (fail-loud)
- 口の在りかは var `LOCAL_CONTENT_URL`、読む先は Vite を立てるときの環境変数 `CONTENT_DIR`
  (既定はリポジトリ直下の `content/`)。`resolveContentStore(env)` の形は変えない
  (同期は Queue からも呼ばれ、要求の origin を持たないため)

## 帰結 / Consequences

- 良い面: 手元の `.dev.vars` に Artifacts のトークンが要らなくなった。書いた下書きを、commit も
  push もせずに `POST /api/v1/refresh` 1 回で手元の画面に出せる
- 悪い面・トレードオフ: 手元には push の合図が無いので、同期は手で叩く。dev サーバーのポートを
  5173 から動かしたら `LOCAL_CONTENT_URL` も合わせる (合っていなければ refresh が throw する)
- 検証方法: `vite/content-bridge.test.ts` が列挙の範囲 (未コミットは入り、消したものと
  `.gitignore` のものは入らない)、ハッシュが `git rev-parse` と一致すること、列挙の外を
  読ませないこと、loopback の判定を固定している

## 参考 / More Information

- [#461](https://github.com/yantene/yantene.net/issues/461)
- [ADR 0034](0034-artifacts-as-content-source-of-truth.md)
- [ADR 0040](0040-article-status-and-reader-facing-repository.md)
