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

外に見える名前はすべて `articles` に揃える。

- ページ: `/articles`、`/articles/<slug>`
- 原文 Markdown: `/articles/<slug>.md` と、`Accept` で原文を名指ししたときの
  `/articles/<slug>` ([ADR 0009](0009-serve-note-source-markdown-verbatim.md) /
  [ADR 0020](0020-negotiate-note-source-markdown-on-accept.md) の `/notes/<slug>` は
  この URL のこと)
- JSON API とアセット: `/api/v1/articles`、`/api/v1/articles/<slug>/assets/<path>`
- OG 画像: `/og/articles/<slug>`
- sitemap、JSON-LD の `mainEntityOfPage`、Atom の `<link>`
- 正本の配置: `articles/<slug>.md` と `articles/<slug>/<asset>`。refresh はここだけを読む

### 動かさないもの

**内側の名前は据え置く。** D1 の表 (`notes`、`note_*`)、R2 のキー (`notes/<slug>/`、
`og/notes/`)、コードの識別子 (`Note`、`handlers/notes/`、`note-*` のコンポーネント)。

表を改名すると後方互換でなくなり、environments.md の 2 段リリースが要る。R2 のキーを
変えると写し直すまで全記事の原文と MDAST が見つからない。どちらも読み手には見えない
名前で、動かして得るものが無い。コードの識別子も同じで、改名は数百ファイルに触る
機械的な差分になり、URL を動かす変更と同じ PR に混ぜるとレビューができなくなる。
内側の名前をどう呼ぶかは、この決定の範囲に含めない。

### 旧 URL からのリダイレクト

`/notes/<slug>` から `/articles/<slug>` へ 308 で送るのは、**2026 年に公開した記事だけ**
(`domain/note/article-path.ts` の表)。それより前の記事が `/notes/<slug>` で出ていた期間は
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
その人の行を消せてしまう (行の鍵は note と source で、表記を含まない)。

### Atom の `<id>`

記事の URL そのものを使い続ける。URL を動かせば `<id>` も動き、購読者には 1 回だけ全件が
新着に見える。URL と別の識別子 (tag URI など) を持っても、今回 `<id>` が変わることは同じで、
違いが出るのは次に URL を動かしたときだけである。その日のために識別子を 2 つ持たない。

### 閲覧数・リアクション・ベクトル

すべて `notes.id` か `notes.slug` を鍵にしていて、URL を持たない。影響は無い。

## 帰結 / Consequences

- 良い面: 内部の呼び名と外向きの語彙が揃う。短文が `/notes/<id>` を使える
- 悪い面: 2025 年以前の記事の `/notes/<slug>` は 404 になる
- 悪い面: フィードの購読者に 1 回だけ全件が新着に見える
- 悪い面: 正本の配置と URL は `articles` なのに、表と R2 とコードは `notes` のまま。
  読むときに読み替えが要る
- 運用: 正本のリポジトリ側で `notes/` を `articles/` に動かす。変更検出のハッシュに正本の
  パスが入っているので、動かせば通常の refresh が全記事を作り直し、D1 のカバー画像 URL と
  R2 の MDAST に埋まったアセット URL が `/api/v1/articles/` になる (force は要らない)。
  動かして refresh が走るまでは記事中の画像と音源とカバー画像が 404 になる。動かす前に
  refresh を叩いても、`articles/*.md` が 1 本も無いので全件削除のガードで止まる
- 運用: 本文にルート相対で直書きした `/notes/<slug>` の記事間リンクと、raw HTML の
  `<source src="/api/v1/notes/...">` は refresh では直らない。正本の Markdown を書き換える
- 検証方法: `legacy-redirects.handler.test.ts` が表の件数を実装と突き合わせ、表に無い
  `/notes/<slug>` が 308 を返さないことを固定する。`notes-refresh.service.test.ts` が
  `notes/` の下の記事を読まないことを固定する。`webmention-verification.service.test.ts` が
  届け出た表記と張られたリンクの表記が食い違っても行が消えないことを固定する

## 参考 / More Information

- #410 投稿を articles / notes / slides の 3 種別にする (親)
- #411 長文ノートを articles に改名し、`/notes/<slug>` を `/articles/<slug>` へ移す
- [ADR 0029](0029-retire-tags.md) タグをやめ、分類は `article` の 1 つに畳む
- [Post Type Discovery](https://www.w3.org/TR/post-type-discovery/)
