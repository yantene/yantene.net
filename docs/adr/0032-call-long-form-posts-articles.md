# 0032. 長文の投稿を article と呼び、`/articles/<slug>` で配る

- Status: Accepted
- Date: 2026-09-09
- Deciders: @yantene

## Context / 背景

投稿の種別を 3 つに分ける (#410)。長文、タイトルを持たない短文、発表資料である。いまある
のは長文の 1 種別だけで、サイトはそれを「ノート」と呼び、`/notes/<slug>` で配っていた。

この呼び名は外向きの語彙と逆さまになっている。microformats2 の
[Post Type Discovery](https://www.w3.org/TR/post-type-discovery/) は、`h-entry` に
`p-name` (表題) があり、それが `e-content` の先頭部分でなければ **article**、無ければ
**note** と判定する。長文は表題を持つので article であり、note は「表題の無い短い投稿」を
指す語である。[ADR 0029](0029-retire-tags.md) でカテゴリに `article` を出すと決めたとき
から、内部の呼び名と外向きの語彙が食い違っていた。

短文を足す前に直す。足してから直すと、`/notes/<id>` に短文が載ったあとで長文の
`/notes/<slug>` を動かすことになり、2 種別の URL が同じ接頭辞の下で入れ替わる。

## 検討した選択肢

- **案 A: 長文を `articles` に改名し、`/notes/` を短文に譲る (採用)** — 正本の配置は
  `articles/<slug>.md`、URL は `/articles/<slug>`。
  - Pros: 外向きの語彙 (Post Type Discovery、Atom の category) と内部の呼び名が揃う。
    短文が `/notes/<id>` を素直に使える
  - Cons: 外に残った `/notes/<slug>` のリンクが行き先を失う。フィードの `<id>` が変わる
- **案 B: 長文を `notes` のまま残し、短文に別の名前を付ける** — 例えば `posts` や `micro`。
  - Pros: 何も動かさなくてよい
  - Cons: 「表題の無い短い投稿」を note 以外の名で呼び、表題のある長文を note と呼び続ける。
    外向きの語彙との食い違いが恒久になり、読み手にも書き手にも説明が要る
- **案 C: `/notes/*` を `/articles/*` へ接頭辞ごと恒久リダイレクトする** — 案 A の
  リダイレクトの範囲を全件にする。
  - Pros: 外に残ったリンクがすべて生きる
  - Cons: `/notes/` は短文に譲る場所で、恒久リダイレクトはブラウザと CDN に覚えられる。
    存在しない `/notes/<なんでも>` にまで恒久リダイレクトを返し、後から短文を置いたとき、
    覚えられている間はその転送が短文の URL を奪う

## 決定

案 A を採る。

### 名前

表題のある長文が **article**、無い短文が **note**。Post Type Discovery の判定にそのまま
合わせる。記事ページの `h-entry` は `p-name` を持ち、その値は `e-content` の先頭部分では
ないので article と判定される。カテゴリは [ADR 0029](0029-retire-tags.md) のとおり
`article` で固定。`/notes/` は表題の無い短文のために空けておく。

### 動かすもの

名前はすべて `article` に揃える。外に見えるものも、見えないものも。

- ページ: `/articles`、`/articles/<slug>`
- 原文 Markdown: `/articles/<slug>.md` と、`Accept` で原文を名指ししたときの
  `/articles/<slug>` ([ADR 0009](0009-serve-note-source-markdown-verbatim.md) /
  [ADR 0020](0020-negotiate-note-source-markdown-on-accept.md) の `/notes/<slug>` は
  この URL のこと)
- JSON API とアセット: `/api/v1/articles`、`/api/v1/articles/<slug>/assets/<path>`。
  応答の鍵も `articles` / `article`
- OG 画像: `/og/articles/<slug>`
- sitemap、JSON-LD の `mainEntityOfPage`、Atom の `<link>`
- 正本の配置: `articles/<slug>.md` と `articles/<slug>/<asset>`。refresh はここだけを読む
- D1 の表と列: `articles`、`article_reactions`、`article_embeddings`、`article_similarities`、
  `article_id`。検索の索引 (FTS5) は `articles_fts`
- R2 の鍵: `articles/<slug>/` と `og/articles/`
- KV のセッション: `viewedArticles`
- コード: `Article`、`ArticleSlug`、`domain/article`、`handlers/articles/`、
  `articles-refresh.service.ts`。フロントのコンポーネントは `article-*` (`article-header`、
  `article-timeline`、`article-branches`、`article-actions`)

読み手に見えない名前まで揃えるのは、短文の投稿を `note` と呼ぶと決めた以上、長文を指す
`note` が残っていれば同じ名前が別の意味で同居するため。Markdown 本文の組版 (`.mdast-prose`)
と時系列の季節の印 (`.season-dot-*`) は投稿の種別を問わないので、どちらの名も付けない。

### `note` のまま残すもの

- 旧 URL としての `/notes/` (下のリダイレクトと Webmention の受け口が持つ文字列)
- `footnote`、GFM の Alert の種別 `note` (`> [!NOTE]`)。記事とは別の語
- 正本のリポジトリ名 `yantene/notes`

### 旧 URL からのリダイレクト

`/notes/<slug>` から `/articles/<slug>` へ 308 で送るのは、**2026 年に公開した記事だけ**
(`domain/article/article-path.ts` の表)。それより前の記事が `/notes/<slug>` で出ていた期間は
短く (このサイト自体が 2026 年 8 月に載せ直したもの)、外に残ったリンクは諦める。
`/notes/` の下に恒久リダイレクトを置くほど短文がその URL を使えなくなるので、表は増やさない。

表に載る記事は `/notes/<slug>.md` も送り、末尾のスラッシュ付きと POST (改名前に開いた
ままのページのリアクションのフォーム) も受ける。旧サイト (2017 年で止まった Jekyll) からの
`/<legacy>.html` は `/articles/<slug>` へ直に送り、2 段のリダイレクトにしない。

一覧の `/notes` は 307 で `/articles` へ送り、`?q=` や `?page=` のクエリはそのまま渡す。
あの URL は短文の一覧として戻ってくるので、ブラウザに覚えられる 308 は置かず、
`Cache-Control: no-store` で覚えさせない。

リダイレクトは `legacy-redirects.handler.ts` が静的パスとして 1 本ずつ登録する。可変
パターンにすると Hono の SmartRouter が RegExpRouter を諦め、アプリ全体が遅いマッチャーを
通る。

### Webmention

`target` の列はスラグを持っているので書き換えは要らない。受け口は `/articles/<slug>` 宛てに
加え、上の表に載る記事に限って `/notes/<slug>` 宛ても受ける。送り手のページとの照合は、
届け出た表記に依らず正規の URL と旧 URL の両方に対して行う。届け出た表記だけで照合すると、
正規の URL を張っている他人のページを旧 URL 宛てで届け出て「リンクが無い」と判定させ、
その人の行を消せてしまう (行の鍵は article と source で、表記を含まない)。

### Atom の `<id>`

記事の URL そのものを使い続ける。URL を動かせば `<id>` も動き、購読者には 1 回だけ全件が
新着に見える。URL と別の識別子 (tag URI など) を持っても、今回 `<id>` が変わることは同じで、
違いが出るのは次に URL を動かしたときだけである。その日のために識別子を 2 つ持たない。

### 閲覧数・リアクション・ベクトル

すべて `articles.id` か `articles.slug` を鍵にしていて、URL を持たない。影響は無い。

## 帰結 / Consequences

- 良い面: 内部の呼び名と外向きの語彙が揃う。短文が `/notes/<id>` と `note` の名を使える
- 悪い面: 2025 年以前の記事の `/notes/<slug>` は 404 になる
- 悪い面: フィードの購読者に 1 回だけ全件が新着に見える
- 運用: 正本のリポジトリ側で `notes/` を `articles/` に動かす。変更検出のハッシュに正本の
  パスが入っているので、動かせば通常の refresh が全記事を作り直し、D1 のカバー画像 URL と
  R2 の MDAST に埋まったアセット URL が `/api/v1/articles/` になる (force は要らない)。
  動かして refresh が走るまでは記事中の画像と音源とカバー画像が 404 になる。動かす前に
  refresh を叩いても、`articles/*.md` が 1 本も無いので全件削除のガードで止まる
- 運用: 本文にルート相対で直書きした `/notes/<slug>` の記事間リンクと、raw HTML の
  `<source src="/api/v1/notes/...">` は refresh では直らない。正本の Markdown を書き換える
- 運用: D1 の表の改名は 1 段でしか出せない (改名に中間状態が無い)。`Migrate D1` →
  `Deploy` の数十秒、旧コードが `no such table: notes` で 500 になる。静かな時間帯に出す
- 運用: R2 の鍵は写し直すまで見つからないので、`articles/<slug>/` に無ければ改名前の
  `notes/<slug>/` を読む逃げ道を置く。書くのは `articles/` だけで、refresh の片付けが
  旧鍵の下を消す。リリース直後に force refresh を 1 回流せば旧鍵は残らず、逃げ道は
  次のリリースで消す。`og/notes/` は写し直しでは消えないので手で消す
- 運用: KV のセッションに残る `viewedNotes` は読まない。その日にすでに数えた記事を
  1 回だけ余計に数えるだけで、互換の経路は置かない
- 検証方法: `legacy-redirects.handler.test.ts` が表の件数を実装と突き合わせ、表に無い
  `/notes/<slug>` が 308 を返さないことを固定する。`articles-refresh.service.test.ts` が
  `notes/` の下の記事を読まないことを固定する。`webmention-verification.service.test.ts` が
  届け出た表記と張られたリンクの表記が食い違っても行が消えないことを固定する。
  `r2-article-content-cache.test.ts` が旧鍵への逃げ道と片付けを固定する

## 参考 / More Information

- #410 投稿を articles / notes / slides の 3 種別にする (親)
- #411 長文ノートを articles に改名し、`/notes/<slug>` を `/articles/<slug>` へ移す
- #429 長文の記事を指す note をコードと保存の名前から無くし、article に揃える
- [ADR 0029](0029-retire-tags.md) タグをやめ、分類は `article` の 1 つに畳む
- [Post Type Discovery](https://www.w3.org/TR/post-type-discovery/)
