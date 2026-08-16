# 0004. コンテンツの正本を GitHub リポジトリに置き、D1 / R2 をキャッシュにする

- Status: Accepted
- Date: 2026-07-05
- Deciders: @yantene

## Context / 背景

ノート (Markdown + 画像) の正本をどこに置き、どう配信するかを決める必要がある。
要件は以下の通り。

- 手元で Markdown を書いて `git push` するだけでコンテンツが反映されるワークフロー
- 管理画面は作らない
- Workers からファイルを効率的に読み取れること
- バージョン管理があること
- 配信 (一覧・詳細・画像) が正本のレイテンシやレート制限に引きずられないこと

## 検討した選択肢

- **案 A: R2 を正本にする** — rclone 等で R2 に直接 sync する。
  - Pros: Workers Binding で直接読み取れる。ストレージ単価が安い。
  - Cons: バージョン管理がない。sync ツールの設定が別途必要。git ワークフローに乗らない。
- **案 B: GitHub リポジトリ + CI → R2 sync** — GitHub に push → CI で R2 に sync する。
  - Pros: git ワークフロー。CI パイプラインで変換処理を挟める。
  - Cons: CI の設定・管理が要る。sync の仕組みを自前で書く。コンテンツを変換する場所が
    アプリの外に出て、パース規則の変更が CI とアプリの二箇所に散る。
- **案 C: GitHub リポジトリを正本にし、D1 / R2 をキャッシュにする (採用)** —
  リクエストは D1 + R2 だけで捌き、正本には同期 (refresh) のときだけ触る。
  - Pros: `git push` で完結する。バージョン管理は git がそのまま与える。パース規則は
    アプリ内の 1 箇所にある。配信経路が正本から切り離される。
  - Cons: 正本が Cloudflare 外にある。3 層 (GitHub / D1 / R2) の構成が複雑。

## 決定

案 C を採用する。

- コンテンツの正本は GitHub リポジトリ (`yantene/notes`)。`notes/<slug>.md` が本文、
  `notes/<slug>/<filename>` が画像アセット。
- D1 はメタデータインデックス (スラグ・タイトル・要約・公開日・更新日・タグ・
  コンテンツハッシュ・閲覧数) を持つ。
- R2 は原文 Markdown・パース済み MDAST・画像をキャッシュする。
- **通常のリクエストでは D1 + R2 からのみ配信し、正本には触らない。**
- 正本 → D1 / R2 の同期は `POST /api/v1/refresh` のときだけ行う。ユーザー認証ではなく
  運用シークレット (`REFRESH_SECRET`) と `X-Refresh-Token` ヘッダで保護した手動トリガー。
  シークレット未設定なら静かに無効化せず fail-loud で throw する。
- 変更検出はコンテンツハッシュで行う。refresh 時に git tree API
  (`?recursive=1`) で全 blob のパスと `sha` (git blob ハッシュ) を取得し、
  md + そのノートの全アセットのハッシュを合成した値を D1 の保存済みと比較する。
  変わったノートだけ内容を読み直して再パース・upsert する。正本から消えたノートは
  D1 / R2 から掃除する。
- **実装側の変更 (MDAST の作り方を変えた等) はハッシュが変わらないので通常の refresh では
  反映されない。** そうした移行は `?force=true` を付けて流す。

### 読み取り経路

- ドメインは技術非依存の `IContentStore` (`listTree()` / `readFile(path)`) を定義する
  ([0003](0003-clean-architecture-and-cqrs.md))。ドメインは GitHub を知らない。
- infra の `GitHubContentStore` が実装する。ツリーは git tree API で取得し、ファイル内容は
  contents API を raw メディアタイプ (`application/vnd.github.raw+json`) で叩いて生バイト列を
  そのまま受け取る (下記の訂正)。Workers の fetch キャッシュが push 直後の古いツリーを
  返さないよう `cache: "no-store"` で読む。
- 接続先は wrangler の vars (`GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH`)、
  トークンは secret (`GITHUB_TOKEN`)。**未設定のときは静かに劣化させず fail-loud で throw する**
  (`resolveContentStore`)。

## 帰結 / Consequences

- 良い面: `git push` だけでコンテンツが反映される自然なワークフロー。バージョン管理が
  git からそのまま得られる。配信経路が R2 + D1 に閉じるので、正本の障害やレート制限が
  読者に届かない。
- 悪い面・トレードオフ: 正本が Cloudflare 外 (GitHub) にある。3 層構成の複雑さ。
  refresh を叩くまで公開内容が更新されない (push と反映が自動で繋がっていない)。
  実装変更を既存ノートへ反映するには force refresh を忘れずに流す必要がある。
- 検証方法: `github-content-store.test.ts` が fetch モックでツリー取得・ファイル読み取り・
  トークンの使い回しを固定する。`notes-refresh.service.test.ts` がハッシュによる変更検出・
  削除時の掃除・force の挙動を固定する。通常リクエストが正本に触らないことは、
  ハンドラのテストが `IContentStore` 抜きの env で 200 を返すことで担保する。

## 参考 / More Information

- 実装: `app/backend/infra/github/github-content-store.ts` /
  `app/backend/services/notes-refresh.service.ts` /
  `app/backend/handlers/notes/resolve-content-store.ts`
- [0003](0003-clean-architecture-and-cqrs.md) / [0005](0005-mdast-over-html-rendering.md) /
  [0009](0009-serve-note-source-markdown-verbatim.md)
- [#282](https://github.com/yantene/yantene.net/issues/282) — 本文の訂正 (下記)

## 訂正 (2026-08-16)

本 ADR は production 公開後に本文を書き換えた。`.claude/rules/adr.md` の不変性
(公開後は Accepted な ADR の本文を書き換えない) に対する例外である。決定
(正本を GitHub に置く / D1 と R2 は写し) は変えていない。

追記ではなく本文の訂正で処理したのは、ここが**次に実装へ触る人が前提として読む場所**
だからである。誤った記述を残したまま下に訂正を足すと、上だけを読んだ人が
「base64 を復号している」という前提で改修に入る。[ADR 0019](0019-inline-style-for-math.md) /
[ADR 0018](0018-typeset-math-with-temml.md) が防御の範囲について同じ判断をしているのに倣った。

### 何が誤っていたか

「読み取り経路」節は、公開時点では

> ファイル内容は contents API で取得し、base64 を復号して生バイト列を返す

としていた。実装は一度も base64 を復号していない。`readFile` は
`Accept: application/vnd.github.raw+json` を送り、`response.arrayBuffer()` を
そのまま `Uint8Array` にしている。

### 誤りの出どころ

この文は本 ADR が発生源ではない。**元は実装ファイルのコメントで、本 ADR がそれを写した。**

| 日付                   | できごと                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-05 (`d30ffe7`) | `github-content-store.ts` を追加。ファイル冒頭に誤った説明、52 行下 (同ファイル 36 行目と 88 行目) に正しい注記「raw メディアタイプで生バイトを直接受け取る (base64 復号不要)」を同時に書いた |
| 2026-08-10 (`22f26e7`) | 公開前の整理で本 ADR を起こし、冒頭の説明の方を写した                                                                                                                                         |

つまり実装ファイルの中で最初から 2 つの記述が矛盾しており、ADR はその誤っている側だけを
拾った。 今回は両方を実装に合わせ、実装ファイルの冒頭からは説明を落として `readFile` の
注記を指すだけにした (同じことを 2 度書かないため。0018 が写しを 0019 への参照に
置き換えたのと同じ扱い)。

なお [#257](https://github.com/yantene/yantene.net/issues/257) /
[#270](https://github.com/yantene/yantene.net/issues/270) は形が違う。あちらは
**写した後で片方だけが直り、残りが古びた**もの (0019 の訂正が 0018 の写しに及ばなかった)。
本件は写した時点で既に食い違っていた。原因は違うが、同じことを 2 か所に書けば、どちらの
壊れ方もするという点は共通している。

### 併せて足した見張り

`Accept` に raw メディアタイプを送っていることを、`github-content-store.test.ts` が
見るようにした。これまで見ていたのは URL だけで、この指定を落としても全テストが緑のまま
通った。落とすと contents API が JSON の封筒を返し、その生バイトが Markdown として
D1 と R2 に書かれる。記述だけで支えるのをやめ、テストで固定する。
