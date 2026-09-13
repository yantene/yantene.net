# プロダクト概要

## コンセプト

yantene.net は yantene の**発信のすべてを集約するハブ**。

- エッセイ、技術記事、ポートフォリオなど、対外的な発信はここに一本化する
- X、GitHub、Bluesky 等のソーシャルメディアへのポータルでもある
- 特定の読者層は狙わない。自分の言葉を、自分の場所から発信する

### なぜ自作するか

Web サイトは自己表現の場であり、Web 屋として細部にこだわりたい。
既存のブログサービスでは実現できない自由度を確保する。
同時に、新しい技術を試す遊び場としても機能する。

### デザインの方向性

- Celestim（天体アニメーション）は天体へのロマンから
- 装飾は控えめだが、ところどころに遊び心を入れる

## コアドメイン: 記事 (article)

記事は Markdown 形式の長文で、エッセイ・技術記事・その他の発信を包含する。URL は
`/articles/<slug>`、コンテンツリポジトリの配置は `articles/<slug>.md`、コードと D1 / R2 / KV の中でも
`Article` / `articles` で通す ([ADR 0032](../../docs/adr/0032-call-long-form-posts-articles.md) /
[ADR 0033](../../docs/adr/0033-rename-note-to-article-in-storage-and-code.md))。
`note` は表題の無い短文の投稿 (#412) のために空けてある名前で、記事の意味では使わない。

- スラグ (slug) ベースの URL ルーティング
- Markdown 本文 + フロントマター（メタデータ）
- 画像等のアセットを記事に紐付けて管理
- ページネーション対応の一覧表示
- SSR によるクローラー・ボット対応

## コンテンツワークフロー

手元で Markdown を書き、コンテンツリポジトリに `git push` する。**push を合図に D1 / R2 へ
同期される。** 管理画面は設けない。

コンテンツリポジトリは Cloudflare Artifacts に置く
([ADR 0034](../../docs/adr/0034-artifacts-as-content-source-of-truth.md))。環境ごとに
リポジトリを分け (`yantene/yantene-production` / `yantene/yantene-staging`)、どちらも
`main` だけを見る。どれを読むかは `wrangler.jsonc` の vars
(`CONTENT_SOURCE` / `ARTIFACTS_REPO`) が決める。**3 環境とも `artifacts`。**
手元の作業ツリーを読む `local` を足すのは
[#461](https://github.com/yantene/yantene.net/issues/461)。

その環境のリポジトリの `main` に push すると、push が Queue に流れて同期が走る
([ADR 0035](../../docs/adr/0035-refresh-on-push-through-a-queue.md))。

### 記事の書き方はここに書かない

記事をどう書いてどう出すか (公開フロー、フロントマターの書式、スラグ、文体、推敲) の
規範は**コンテンツリポジトリ側**にある。

- `content/AGENTS.md` — 書き手の規範
- `content/.agents/skills/` — 執筆を進める skill 群

ここに置くのは**アプリが記事をどう扱うか**だけ。同期、保存、描画、配信。
二重に持つと、どちらかが必ず古びる。

`content/` は `.gitignore` に入っているので `CLAUDE.md` から `@` で読み込めない。
記事を書くときは手で開くこと。

⚠️ **あちらの規範をこちらに当てはめないこと。** たとえば `content/AGENTS.md` の
「語調」は `## 記事の文体` の下にあり、**記事本文のための規範**である。これを画面の
文言に当てはめて [#486](https://github.com/yantene/yantene.net/issues/486) を起こした。
画面の文言の語調は下の「画面の文言は敬体で書く」にある。

### 手元の作業用 clone は `content/`

このリポジトリの `content/` に production のリポジトリを clone して書く。**別リポジトリなので
`.gitignore` に入れてあり**、このリポジトリの履歴にも lint / 整形の対象にも入らない。

```bash
git -c credential.helper=libsecret -c credential.useHttpPath=true \
  clone https://<account-id>.artifacts.cloudflare.net/git/yantene/yantene-production.git content
git -C content config credential.helper libsecret
git -C content config credential.useHttpPath true
git -C content remote rename origin artifacts-production
git -C content remote add artifacts-staging \
  https://<account-id>.artifacts.cloudflare.net/git/yantene/yantene-staging.git
```

`credential.useHttpPath` が要る理由は environments.md を参照。

**push の手順と関門 (`scripts/check-publish`) は `content/AGENTS.md` の「公開フロー」。**
記事を確かめるために staging へ先に上げる運用は採らない
([#437](https://github.com/yantene/yantene.net/issues/437))。

同期は**同時に 2 つ走らない**。立て続けに push しても、最後に走った同期が最新の中身を
読むので、リポジトリの最新の姿が必ず D1 / R2 に載って終わる。

### 実装変更を既存記事に反映するとき (force refresh)

`POST /api/v1/refresh` の変更検出は **md + アセットのハッシュ**で行う。そのため
「MDAST の作り方を変えた」といった**実装側の変更は、通常の refresh では既存記事に
反映されない** (ハッシュが変わらないので全件スキップされる)。

MDAST の生成内容や、MDAST から導くメタデータ (要約など) の作り方を変えたら、
デプロイ後に一度 force 付きで叩くこと。

```bash
curl -X POST "<origin>/api/v1/refresh?force=true" -H "X-Refresh-Token: <secret>"
```

過去に該当した変更:

- 画像の width/height 埋め込み ([#99](https://github.com/yantene/yantene.net/issues/99))
- 要約から生 HTML を除外 ([#112](https://github.com/yantene/yantene.net/issues/112))
- 原文 Markdown の R2 キャッシュ ([#106](https://github.com/yantene/yantene.net/issues/106))。
  force refresh を流すまで `/articles/<slug>.md` は 500 になる (fail-loud)
- 数式の MathML 埋め込み ([#174](https://github.com/yantene/yantene.net/issues/174))。
  force refresh を流すまで既存記事の `$...$` は素の文字列のまま出る
- 本文のむき出し URL のリンクカード ([#172](https://github.com/yantene/yantene.net/issues/172))。
  カードの取得は「変更のあった記事が参照する URL」と「期限切れの既存カード」を対象にするので、
  導入直後は既存記事のリンクが 1 つもカードにならない。一度 force refresh を流すこと
- 数式の変換を Temml へ移した ([#208](https://github.com/yantene/yantene.net/issues/208))。
  force refresh を流すまで、既存記事の数式は KaTeX が組んだ MathML のまま出る
  (関数名の後ろが詰まる)
- リンクカードの絵の取り逃しを覚えるようにした ([#255](https://github.com/yantene/yantene.net/issues/255))。
  既存のカードは「取り逃していない」ものとして入っているので、いま絵の欠けているカードは
  14 日の期限が切れるまで取り直されない。急ぐなら force refresh を流すこと
- 中身の無い応答を「取れた」ことにしないようにした ([#293](https://github.com/yantene/yantene.net/issues/293))。
  0 バイトの絵は `has_image` が立ったまま入っているので、**14 日の期限が切れるまで
  取り直されない**。急ぐなら force refresh を流すこと。

  ⚠️ **Webmention の顔には効かない。** あちらは送り手が再送してきたときにしか写し直さず、
  期限で取り直す仕組みが無い。**既に入っている 0 バイトの写しは残ったまま**だが、
  読み手の画面では頭文字 (返信なら名前だけ) に倒れるので、見た目は壊れない
  ([#322](https://github.com/yantene/yantene.net/issues/322))。R2 の置き場を空けたければ
  手で消すこと。

- 関連記事を本文のベクトルで並べるようにした ([ADR 0028](../../docs/adr/0028-relate-notes-by-embedding-similarity.md))。
  ベクトルを作るのは「変更のあった記事」だけなので、**導入直後は既存記事のベクトルが 1 本も
  入らない**。関連記事が全記事で空になるので、一度 force refresh を流すこと。
  1 回で作り直せるのは 30 本までで、溢れた分は次の refresh に回る。
- 埋め込みモデルを差し替えた ([ADR 0030](../../docs/adr/0030-switch-embedding-model-to-qwen3.md))。
  **force は要らない。** `article_embeddings.model` の列が違えば通常の refresh が作り直す。ただし
  1 回 30 本までなので、**記事数 ÷ 30 を切り上げた回数**だけ通常の refresh を流すこと。揃うまで
  近さの書き直しは走らず、前のモデルの並びが出続ける。結果の `embeddings.deferred` が 0 になり
  `embeddings.rewrittenPairs` が 0 以外になったら揃っている。`failed` が空でなければもう一度。

  ```bash
  curl -X POST "<origin>/api/v1/refresh" -H "X-Refresh-Token: <secret>"
  ```

- 記事の URL とアセット API を `/notes` から `/articles` へ移した
  ([ADR 0032](../../docs/adr/0032-call-long-form-posts-articles.md))。**force は要らない。**
  コンテンツリポジトリ側で `notes/` を `articles/` に動かすと、ハッシュにコンテンツリポジトリのパスが入っているので通常の
  refresh が全記事を作り直す (D1 のカバー画像 URL と、R2 の MDAST に埋まったアセット URL の
  両方)。動かして refresh が走るまでは、記事中の画像と音源とカバー画像が 404 になる。
  動かす前に叩いた refresh は `articles/*.md` が無いので全件削除のガードで止まる (記事は
  消えない)。全記事のハッシュが変わるので埋め込みも作り直しになり、1 回 30 本までなので
  **記事数 ÷ 30 を切り上げた回数**だけ refresh を流すこと。

  refresh では直らないものが 2 つある。本文に**ルート相対で直書きした** `/notes/<slug>` の
  記事間リンクと、raw HTML の `<source src="/api/v1/notes/...">`。どちらもコンテンツリポジトリの Markdown を
  書き換える (`](/notes/` → `](/articles/`、`/api/v1/notes/` → `/api/v1/articles/`)。

- D1 の表と R2 のキーを `notes` から `articles` に改めた
  ([ADR 0033](../../docs/adr/0033-rename-note-to-article-in-storage-and-code.md))。
  表は migration が改名するので、force が要るのは **R2 の写しを `articles/<slug>/` に
  移すため**。旧キー `notes/<slug>/` は読まないので、写し直すまで記事の原文と MDAST は
  見つからない。写し直しても旧キーの写しは消えないので、R2 の置き場を空けたければ手で消す
  (OG 画像の `og/notes/` も同じ)。

## データモデルとストレージ戦略

コンテンツリポジトリは環境ごとに 1 つ (Cloudflare Artifacts の `yantene/yantene-production` /
`yantene/yantene-staging`)。D1 はメタデータのインデックス、R2 は原文 Markdown・パース済み
MDAST・画像のキャッシュを担う。設計判断の詳細は
[ADR 0034](../../docs/adr/0034-artifacts-as-content-source-of-truth.md) を参照。

- コンテンツリポジトリ: Markdown 本文 (`articles/<slug>.md`) + 画像アセット (`articles/<slug>/<filename>`)
- D1: メタデータインデックス (スラグ、タイトル、公開日、更新日、要約など)
- R2: 原文 Markdown キャッシュ + パース済み MDAST キャッシュ + 画像キャッシュ

### フロントマターでメタデータ管理

Markdown ファイル自体にメタデータを持たせる。refresh が vfile-matter でパースし、
ArticleTitle / ImageUrl 等の VO に変換する。**読めない値は記事ごとスキップして報告する**
(fail-loud)。

**書式は `content/AGENTS.md` の「フロントマター」。** 欄を足すときは両方を直すことになる
ので、あちらを先に決めてからこちらの VO を足す。

### どの段階の記事も同期し、隠すのは配信の時点で行う

フロントマターの `status` が記事の段階と公開範囲を持つ
([ADR 0040](../../docs/adr/0040-article-status-and-reader-facing-repository.md))。
**「同期しない記事」という概念は無い。** どの `status` の記事も D1 と R2 に載る。

| status      | 一覧・フィード・sitemap・検索・関連記事・人気順 | URL 直打ち       | 管理者 |
| ----------- | ----------------------------------------------- | ---------------- | ------ |
| `published` | 出る                                            | 見える           | 見える |
| `unlisted`  | 出ない                                          | 見える (noindex) | 見える |
| `withdrawn` | 出ない                                          | 404              | 見える |
| `draft`     | 出ない                                          | 404              | 見える |
| `idea`      | 出ない                                          | 404              | 見える |

書かなければ `published`。読み手から見た振る舞いは 3 種類しかない (公開 / 限定公開 /
隠す) が、`withdrawn` / `draft` / `idea` を分けているのは、「これから書くもの」と
「もう出さないと決めたもの」を管理者の一覧で見分けたいため。

全部同期するのは、**同期しない方式だと取り下げたときに戻せないものがある**ため。
届いた Webmention と閲覧数はこちらの D1 にしか無く、コンテンツリポジトリのどこにも
無い。取り下げて出し直せば元に戻る、を成り立たせるにはこの表に残すしかない。

#### 除外はリポジトリの作り方に畳み込む

配信側の経路ごとに除外条件を書き足す方式は採らない。経路が増えるたびに書き漏らし、
そのとき漏れるのは「見せたくないもの」になる。代わりに**読み取り口そのものを 2 つに
分ける**。

```ts
D1ArticleQueryRepository.forReaders(d1); // 読み手向け
D1ArticleQueryRepository.forAdmin(d1); // すべて
```

コンストラクタは private なので、新しい配信経路を書く人はどちらかを選ばされる。
`forReaders` が通す status は**メソッドごとに固定**してあり、呼ぶ側は選べない
(`findBySlug` だけが `unlisted` も通す。「一覧に出ない」と「URL で読める」の違いは
メソッドの性質なので、ここに畳み込める)。

`forAdmin` で引いた結果を応答に載せるときは `Cache-Control: private, no-store`
(`PRIVATE_CACHE_HEADERS`) を付ける。経路のどこかに載ると読み手に配られ、載った先で
剥がす手立ては無い。

⚠️ **検索の索引と人気順はリポジトリを通らない。** どちらも D1 を直に引くので、絞るのは
それぞれの側。索引には `published` しか入れず、人気順の SQL には `status` の条件を書く。
素通りさせると、**上位 N 件を下書きが埋めてから `forReaders` が落とす**ので結果が
N 件に足りなくなる。

#### 管理者に見せるのは slug で 1 本引く経路だけ

記事ページ・原文 Markdown・アセット・記事の JSON API の 4 つ。一覧・フィード・sitemap・
検索・OG・人気順・関連記事・Webmention の受け口は、ログインしていても `forReaders` で
固定する。管理者が自分の下書きを `/articles` や `/feed.xml` に混ぜて見たいわけではない。
管理者向けの一覧は別に用意する。

#### 読めない値と旧書式

読めない `status` は公開せずスキップとして報告する。公開しないのは、誤って公開する方が
誤って隠すより取り返しがつかないため。

**旧書式の `visibility` が残っていたらエラーにする。** 値が何であっても弾く。無視して
既定の `published` に倒すと、`visibility: private` と書いたままの下書きが黙って公開
される。

段階の判定のために原文を読むのは 1 記事につき 1 回。contentHash が一致する記事は読まずに
飛ばす。`status` を書き換えればハッシュも変わるので、段階の移り変わりは必ず拾える。

### summary は MDAST から自動抽出

一覧表示用の要約は手書きしない。Markdown を MDAST (AST) に変換した後、
見出し・脚注・コードブロック・生 HTML・数式を除いたテキストノードから先頭 160 文字を
切り出す。数式を除くのは、ノードが持つ値が LaTeX 原文で、残すと `\frac{a}{b}` のような
制御綴りが一覧や OGP にそのまま出るため。

生 HTML (`html` ノード) を除くのは、`<s>` や `<div class='box'>` といったタグ文字列が
そのまま要約に出てしまうため。段落中のインライン HTML も対象で、タグに囲まれた本文自体は
別のテキストノードなので要約に残る。

## コンテンツレンダリング

Markdown をサーバー側で HTML に変換せず、MDAST (Markdown AST) のまま JSON API で返す。
フロントエンド側の MDAST/HAST レンダラーが React コンポーネントに変換する。
設計判断の詳細は [ADR 0005](../../docs/adr/0005-mdast-over-html-rendering.md) を参照。

### むき出しの URL はリンクカードになる

段落がリンク 1 つだけでできているとき、リンク先の OGP を読んでカードとして描く
(リスト項目と脚注の中は対象外)。取得は refresh のときだけで、読み手のリクエストは
外部に触れない。設計判断の詳細は
[ADR 0014](../../docs/adr/0014-link-cards-from-ogp-only.md) を参照。

**一度も取れていない URL は素のリンクのまま描く。** 一度は取れた URL が取れなくなった
ときは、**しばらくは前回の中身のままカードとして出る** ([ADR 0014](../../docs/adr/0014-link-cards-from-ogp-only.md))。
相手の短い不調で記事の見た目が変わらないようにするためで、失敗し始めてから 3 日を
越えてもなお取れなければ素のリンクに落ちる。

⚠️ **この「3 日」は壁時計ではない。** 判定されるのは次に取りに行って失敗したときで、
refresh はコンテンツの push で走る。**3 週間 push が無ければ、古い中身が 3 週間出続ける。**
出ている間、消す手立ては無い (force refresh も同じ失敗の経路を通る)。急ぐなら D1 の行を
直接消すことになる。

```bash
pnpm exec wrangler d1 execute yantene-production --env production --remote --command \
  "DELETE FROM link_cards WHERE url = 'https://dead.example/';"
```

**行を消しても R2 の写しは残る。** 掃除は同期の経路でしか走らないので、絵と favicon は
`link-cards/<id>/` に置き去りになる (数 KB)。気になるなら一緒に消すこと。

refresh の結果では `kept` (古い中身のまま持ちこたえた) と `failed` (素のリンクに落ちた)
を分けて返す。見た目の壊れ方が違うので、混ぜて読まないこと。

### 画像はアセット API 経由で配信

Markdown 内の相対パス画像 URL (`./image.png`) を
`/api/v1/articles/<slug>/assets/<path>` に解決する。コンテンツリポジトリの直接 URL を露出させない。

### 数式は refresh 時に MathML へ組む

本文の `$...$` / `$$...$$` は remark-math で数式ノードにし、**refresh のときに KaTeX の
MathML 出力で組んで MDAST に埋める**。描画側は埋まった MathML を出すだけで、読者に数式
ライブラリは送らない。設計判断の詳細は [ADR 0013](../../docs/adr/0013-math-as-mathml-at-refresh-time.md) を参照。

- KaTeX の既定の HTML 出力は使わない。inline `style` で位置を指定するため CSP 下で崩れる
- 読めない LaTeX は refresh がその記事をスキップし、理由を返す (fail-loud)
- `$` は数式の開始と見なされる。`$100 と $200` のような書き方は数式になってしまう

### Mermaid のコードフェンスはブラウザで図になる

本文の ` ```mermaid ` は、**読み手のブラウザで** SVG に組んで差し替える。数式と違って
refresh では何も変換しないので、MDAST は素の `code` ノードのまま、force refresh も要らない。
設計判断の詳細は [ADR 0023](../../docs/adr/0023-render-mermaid-in-the-browser.md) を参照。

- Mermaid 本体は動的 import で遅延して読む。**図を使わない記事には降りてこない**
- 組めなかったソースは、書いたままのコードブロックとして残る (記事は壊れない)
- 図が出るまでに一拍あり、JavaScript が動かない環境とクローラーにはソースが届く

### 原文は `/articles/<slug>.md` で取れる

記事ページ (`/articles/<slug>`) の URL 末尾に `.md` を付けると、コンテンツリポジトリの Markdown を
**そのまま** (フロントマター込み・画像の相対パスも書き換えない) 返す。R2 の原文キャッシュ
から配信し、Hono 側で完結させる (React Router には委譲しない)。設計判断の詳細は
[ADR 0009](../../docs/adr/0009-serve-note-source-markdown-verbatim.md) を参照。

**拡張子なしでも `Accept` で名指しすれば同じものが返る。**

```bash
curl -H 'Accept: text/markdown' https://yantene.net/articles/<slug>
```

`text/markdown` の q 値が `text/html` のそれを厳密に上回ったときだけ原文になる。ブラウザの
Accept は必ず `*/*` を含み、ワイルドカードは Markdown 側に数えないので、記事ページが原文に
化けることはない。判定と、同じ URL が 2 表現を持つことのキャッシュの扱いは
[ADR 0020](../../docs/adr/0020-negotiate-note-source-markdown-on-accept.md) を参照。

## 関連記事は本文のベクトルで並ぶ

記事ページの関連記事は、共通するタグの数ではなく**本文から作ったベクトルの近さ**で
並べる。ベクトルは refresh のときに作って D1 に置き、読み手のリクエストは外部に触らない。
設計判断の詳細は [ADR 0028](../../docs/adr/0028-relate-notes-by-embedding-similarity.md) を参照。

- 近さは**上位 N 件に切らずにペアのまま**持つ。切って保存すると、後から書いた記事が
  古い記事の関連記事に永久に出てこない (refresh は変更のあった記事しか処理しない)
- ベクトルを作れなかった記事は、**前回のベクトルと近さがそのまま残る**。関連記事は
  前の並びで出るので、見た目は壊れない
- `article_similarities` は記事数の 2 乗で増える。57 本で 3,192 行、1,000 本で 999,000 行

## プロフィール

書き手が何者かは**コンテンツリポジトリの `profile.md` + `profile/`** にある。記事と同じ対の形で、
push を合図に D1 と R2 へ同期される
([ADR 0041](../../docs/adr/0041-keep-the-profile-in-the-content-repository.md))。

出る場所は 3 つ。同じ 1 つのデータから賄う。

| 場所       | 出すもの                                                        |
| ---------- | --------------------------------------------------------------- |
| トップ     | 短い自己紹介と、代表 h-card (名前・顔・出ていく先)              |
| 記事の末尾 | 筆者紹介。顔・名前・短い自己紹介・出ていく先・`/about` への導線 |
| `/about`   | 全部。長い自己紹介                                              |

短い自己紹介 (フロントマターの `tagline`) と長い自己紹介 (本文) を分けて持つ。**長いほうを
読むのは `/about` だけ。** 記事の末尾は記事を開くたびに短いほうを読むので、そこに本文まるごとを
運ばせない。

**書式は `content/AGENTS.md`。** 欄を足すときは両方を直すことになるので、あちらを先に
決めてからこちらの VO を足す (記事のフロントマターと同じ手順)。

- 顔写真などのアセットは `/api/v1/profile/assets/<path>` で出す。コンテンツリポジトリの URL は
  露出させない (記事のアセット API と同じ)
- 出ていく先は URL と `isMe` (相互リンクがあるか) をコンテンツ側に、`platform` → アイコンの
  表をコードに置く (`app/lib/social-platforms.ts`)。**知らない `platform` を書くと、その回の
  同期でプロフィールごとスキップされる**
- **経歴の年表は持たない。** 学歴や資格を並べると、読み手が最初に受け取るのが履歴書に
  なる。`/about` は「いま何をしていて、何を信じているか」に絞る
- フロントマターが読めないときはプロフィールだけをスキップして**前の姿を残す**。記事の同期は
  通る

### 同期される前も h-card の殻は立つ

⚠️ プロフィールが無いとき、自己紹介と出ていく先は出さないが、**トップの代表 h-card
(名前・顔・サイトへの参照) と記事末尾の `p-author h-card` は残す**。この 2 つが消えると
Bridgy Fed から見て「誰のサイトか・誰が書いたか」が分からなくなり、**橋が黙って架からなく
なる**。既定の名前と顔は `app/lib/profile-fallback.ts` が 1 か所で持つ。

`/about` も 404 にはせず「準備中」の一枚に倒し、`noindex` を立てる。ヘッダーのナビが常に
指している行き先なので、「そんなページは無い」と答えるのは嘘になる。

⚠️ **`p-author` は記事の末尾にある。** 以前は記事の頭 (`article-header.tsx`) に sr-only で
置いていた。h-entry の中に `p-author` が 2 つ並ぶとパーサは先頭を採るので、見える筆者紹介と
両立しない。足すときは必ずどちらか 1 つにすること。

## サイトの案内 (ヘッダー)

全ページの頭に、行き先・検索・表示する言語・出ていく先を置く。

- 行き先は About / Articles / Notes / Slides の 4 つ。**Notes (#412) / Slides (#415) は
  まだ中身が無く、「準備中」の一文だけを置いたページに繋がっている。** それでもナビには
  出す (サイトが何を置く場所なのかは、置き終わる前から見えていてよい)。中身の無いうちは
  `noindex` を立てて検索結果には出さない。About も、プロフィールがまだ同期されていない
  間は同じ姿になる
- 狭い画面ではロゴ・検索・ハンバーガーだけを帯に残し、残りはドロワーに畳む。
  器は `<details>` なので JavaScript が動かなくても開く
- **ドロワーからも帯と同じ行き先に届く。** ただしドロワー自身が `<details>` なので、
  その中では更に畳まない (フィードも表示する言語も平らに並べる)

### 検索は `⌘K` / `Ctrl+K` で開く

ヘッダーの「Search」を押すか、`⌘K` / `Ctrl+K` でコマンドパレットが開く。打った語で
`/api/v1/search` を叩き、`↑` `↓` で選んで `Enter` で開く。

- **`Ctrl+K` は Chrome の既定 (アドレス欄で検索) と重なる。** `keydown` で
  `preventDefault` してページ側が先に取るので、GNU/Linux と Windows でも開く
- 字を打っている最中 (入力欄に焦点があるとき) は奪わない
- **検索の手立てはこれだけ。** 一覧 (`/articles`) に検索欄は置いていない。JavaScript が
  動かない環境では、押し場所が素のリンクとして `/articles` へ連れて行くが、そこは
  「全部を辿る」ページであって探す場所ではない
- `/articles?q=...` の結果表示は残してある。パレットの「すべての結果を見る」の行き先で、
  絞り直すにはパレットを開き直す
- いまの行き先は記事だけ。3 種別の横断は #417

### 見える名前は訳さない

**場所と区画の名前は、日本語モードでも英語のまま出す。** About / Articles / Notes /
Slides / Popular / Latest / Contents / Related articles / Responses / Feed / All /
Open source licenses / Search / Share がそれにあたる。

- 名前を訳すと、同じ場所が言語によって別の名前で呼ばれることになる (URL は
  `/articles` のままなのに見出しだけ「記事」になる)
- **訳すのは読み手に語りかける文のほう。** 案内・結果・エラーは日本語で書く
- **読み上げにしか出ない名前は訳す。** ランドマークの名前 (「サイト」「メニュー」
  「フッター」) は画面に出ないので、英語で揃える理由が無い

線引きは `app/lib/i18n/locales/locales.test.ts` が固定している。翻訳リソースは
「日本語が空いている = 訳し忘れ」に見えるので、放っておくと親切心で訳し戻される。

### 画面の文言は敬体で書く

⚠️ **記事本文の語調 (常体) と混同しないこと。** `content/AGENTS.md` の「語調」は
`## 記事の文体` の下にあり、**記事のための規範**である。画面の文言には当てはめない。

```
まだ公開された記事がありません。
検索できませんでした。もう一度お試しください。
リアクションは 1 つだけです。別のものを選ぶと入れ替わります。
```

- **敬体 (です・ます)。** 常体は使わない
- **1 文か 2 文で切る。** 3 文続けると案内ではなく喋りになる
- **話し言葉を持ち込まない** (`〜てみて`、`〜の方`)
- 言い差し (`…もう一度。`) で終えない。動詞まで書く
- 英語側は既存に揃えて短い 2 文にする (`Could not search. Please try again.`)

**体言止めのラベル・見出し・説明は語調を持たないので、そのまま置く**
(`comingSoon.*`、`meta.description`、ボタンの字)。

メールの文面 (`services/sign-in-mail.ts`) も敬体。画面と同じ語調になる。

⚠️ **`app/lib/feed.ts` が `articles.lead` と同じ一文を複製している。** 翻訳リソースを
React の外から引けないため。ja.json を書き換えたらあちらも合わせること。

### 表示する言語は読み手が選ぶ

ヘッダーの globe の絵を押すと開く。選ぶと `locale` cookie に 1 年預かり、元のページへ
戻る。設計判断の詳細は
[ADR 0037](../../docs/adr/0037-switch-locale-through-a-cookie-and-a-server-endpoint.md) を参照。

- **畳んである。** 一度選べば 1 年残るので、帯で常に場所を取らせない。EN / JA を
  出したままにしていたときは、帯で 2 番目に目立つものが「一度決めたらほとんど触らない
  設定」になっていた
- 選ばなければ `Accept-Language` で決まる (既定は英語)
- **切り替わるのは UI の文言だけ。** 記事の本文は日本語のまま
- JavaScript が動かなくても切り替わる (器は `<details>`、送るのは素のフォームで
  `POST /locale`)

### フィードは種別ごとに分かれている

ヘッダーの RSS の絵を押すと、All / Articles / Notes / Slides から選べる。設計判断の
詳細は [ADR 0038](../../docs/adr/0038-split-feeds-by-content-kind.md) を参照。

| 種別     | 行き先               | 中身                 |
| -------- | -------------------- | -------------------- |
| All      | `/feed.xml`          | サイトに出るもの全部 |
| Articles | `/feed/articles.xml` | 記事                 |
| Notes    | `/feed/notes.xml`    | **まだ空** (#412)    |
| Slides   | `/feed/slides.xml`   | **まだ空** (#415)    |

- **中身の無い種別も購読先として実在させる** (entry 0 件の Atom)。ナビが行き先を先に
  見せているのと同じ理屈で、いま購読しておけば中身が入った時点で届く。後から URL を
  生やすと、その時点で購読している人が誰もいない状態から始まる
- **Notes / Slides が埋まるまで、All と Articles の中身は同じ。** 両方を購読すると
  同じものが 2 回届く
- ⚠️ **種別ごとのフィードは `/feed/` の下に置くこと。** `/articles/feed.xml` のように
  `/articles/:file` (原文 Markdown) と同じ位置に静的なパスを足すと、Hono の SmartRouter が
  RegExpRouter を諦めて TrieRouter に落ち、アプリ全体のリクエストが遅いマッチャーを通る。
  登録の順を入れ替えても直らない。`markdown.handler.test.ts` が見張っている
- **`/feed.xml` は動かさない。** 既に購読されている URL なので、動かすとリーダーの手元で
  購読が切れる
- 帯に置くのはここだけ。フッターにも一覧の見出し脇にも出さない

## ログイン

`/sign-in` でメールアドレスを打つと、ログイン用のリンクが届く
([ADR 0039](../../docs/adr/0039-sign-in-with-a-magic-link.md))。**管理者と読み手を
区別しない。** 入口は 1 つで、入ったあとに何ができるかを役割が決める。

- 身元はメールアドレス。**合言葉も passkey も持たない**
- 管理者として扱うのは `ADMIN_EMAIL` と一致するアドレスだけ。セッションには焼き付けず、
  要求のたびに引き比べる
- **リンクを送るのも `ADMIN_EMAIL` の 1 つだけ。** いまこのサイトに入れるのはこの
  1 人に等しい。読み手を入れるのは #480 の 3
- **応答は許可の有無で変えない。** 送っても送らなくても同じ画面へ返す。分けると、
  誰が入れるのかを総当たりで数えられる
- ナビには出さない。導線はフッターの Sign in / Sign out
  ([#491](https://github.com/yantene/yantene.net/pull/491)) か、リンクを直接渡す経路

### トークンは `GET` では使わない

会社のメールのリンク検査が 1 回きりのリンクを本人より先に踏み潰す、という定番の事故を
避けるため、**使い切るのは `POST` だけ**にしてある。

- `GET /sign-in/callback` は何も消費せず、トークンを cookie に移して
  `/sign-in/confirm` へ送り直す (`?token=` のまま描くと、閲覧の計測と履歴に載る)
- 頼んだブラウザ自身から踏まれたときだけ、その場で使い切って入れる (確認を挟まない)
- 別の端末で踏んだときは確認を 1 回押す。**端末をまたげることが要件**なので、
  「同じブラウザからでなければ駄目」にはしない

寿命は 15 分。1 つのアドレスに同時に生かしておけるのは 3 本まで (受信箱を埋めさせない)。

### 配信は Cloudflare Email Sending

差出人は `MAIL_FROM`。送信専用のサブドメインなので**返信は受け取れない**ため、
`Reply-To` に `ADMIN_EMAIL` を入れてある。送信元ドメインを有効にする手順は
environments.md を参照。

## 補助ドメイン

- 将来的な機能追加は記事を中心に拡張する

## Webmention

記事に届いた反応 (返信・いいね・リポスト・言及) を受け取り、記事末に出す。受信の設計判断は
[ADR 0016](../../docs/adr/0016-receive-webmentions-in-house.md) を参照。

### 荒らしはブロックリストで止める

誰でも `POST /webmention` を叩けるので、リンクを張れば自分の名前・アイコン・本文を記事末に
載せられる。**承認制は採らず、困った送信元だけを止める。**

止めるときは D1 に 1 行足す。**登録したホストの下位ドメインも一緒に止まる。**

```bash
pnpm exec wrangler d1 execute yantene-production --env production --remote --command \
  "INSERT INTO webmention_blocks (host, reason, created_at) VALUES ('spam.example', '理由', unixepoch());"
```

受信の時点でも読み出しの時点でも同じ判定を通すので、**すでに届いていた行も足した時点で
表に出なくなる**。行そのものは次に再送が来たときに消える。

## 読まれ方の計測

書き手が流入元と読まれ方を知るために、Cloudflare Web Analytics のビーコンを `<head>` に
手で置いている。設計判断の詳細は
[ADR 0021](../../docs/adr/0021-measure-reading-with-web-analytics-beacon.md) を参照。

- 出すのは development 以外 (staging と production)。判断は `APP_ENV` だけを見るので、
  **`pnpm run preview:staging` は手元の localhost でもビーコンを飛ばす**。CSP を確かめる
  ための構成なので承知の上。混ざったぶんはホスト名で切り分ける
- Cloudflare の自動挿入は使わない。挿し込まれたタグには nonce が付かず CSP が止めるため
- CSP に開けてあるのは `script-src` の `beacon.min.js` と `connect-src` の
  `cloudflareinsights.com` だけ。増減すると `app/backend/csp.test.ts` が落ちる
- サイトトークンは `app/lib/constants/web-analytics.ts` にある。HTML に載る公開値なので
  秘密ではない

### 見るのは Web Analytics の素の画面

数を見るのは Cloudflare ダッシュボードの Web Analytics そのもの。**チャートは組まない。**
`Path` で `/articles/` に絞り、`Exclude Bots` を付ければ、この計測を入れた目的 (どの記事が
読まれ、どこから来たか) は素の画面で足りる。Country / Host / Path / Referer / Device type /
Browser / OS / Navigation type で絞れる。

**Analytics Dashboards でチャートは組まない。** 素の画面で足りるものを二重に持つと、
片方だけ古びる。

例外は **Referer Path** で、これだけは素の画面に出ない (出るのは Referer Host まで)。
「どのページのリンクから来たか」まで要るときだけ GraphQL API を叩く。

**ここの数と、記事の閲覧数・人気順は別物。** 人気順は D1 側でサーバーが数えたもので
([ADR 0011](../../docs/adr/0011-reader-session-in-kv.md))、母数も除外の仕方も違う。
突き合わせても一致しない。
