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

## コアドメイン: ノート (Note)

ノートは Markdown 形式の記事で、エッセイ・技術記事・その他の発信を包含する。

- スラグ (slug) ベースの URL ルーティング
- Markdown 本文 + フロントマター（メタデータ）
- 画像等のアセットを記事に紐付けて管理
- ページネーション対応の一覧表示
- SSR によるクローラー・ボット対応

## コンテンツワークフロー

手元で Markdown を書き、コンテンツ正本のリポジトリ (`yantene/notes`) に `git push` する。
その後 `POST /api/v1/refresh` を叩くと D1 / R2 へ同期される。管理画面は設けない。

### 実装変更を既存ノートに反映するとき (force refresh)

`POST /api/v1/refresh` の変更検出は **md + アセットのハッシュ**で行う。そのため
「MDAST の作り方を変えた」といった**実装側の変更は、通常の refresh では既存ノートに
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
  force refresh を流すまで `/notes/<slug>.md` は 500 になる (fail-loud)
- 数式の MathML 埋め込み ([#174](https://github.com/yantene/yantene.net/issues/174))。
  force refresh を流すまで既存ノートの `$...$` は素の文字列のまま出る
- 本文のむき出し URL のリンクカード ([#172](https://github.com/yantene/yantene.net/issues/172))。
  カードの取得は「変更のあった記事が参照する URL」と「期限切れの既存カード」を対象にするので、
  導入直後は既存記事のリンクが 1 つもカードにならない。一度 force refresh を流すこと
- 数式の変換を Temml へ移した ([#208](https://github.com/yantene/yantene.net/issues/208))。
  force refresh を流すまで、既存ノートの数式は KaTeX が組んだ MathML のまま出る
  (関数名の後ろが詰まる)
- リンクカードの絵の取り逃しを覚えるようにした ([#255](https://github.com/yantene/yantene.net/issues/255))。
  既存のカードは「取り逃していない」ものとして入っているので、いま絵の欠けているカードは
  14 日の期限が切れるまで取り直されない。急ぐなら force refresh を流すこと
- 中身の無い応答を「取れた」ことにしないようにした ([#293](https://github.com/yantene/yantene.net/issues/293))。
  0 バイトの絵は `has_image` が立ったまま入っているので、**14 日の期限が切れるまで
  取り直されない**。急ぐなら force refresh を流すこと。

  ⚠️ **Webmention の顔には効かない。** あちらは送り手が再送してきたときにしか写し直さず、
  期限で取り直す仕組みが無い。既に入っている 0 バイトの顔は、D1 の `author_avatar` を
  消して R2 の写しを捨てる手作業が要る ([#322](https://github.com/yantene/yantene.net/issues/322))。

## データモデルとストレージ戦略

コンテンツの正本は GitHub リポジトリ (`yantene/notes`) に置く。
D1 はメタデータのインデックス、R2 は原文 Markdown・パース済み MDAST・画像のキャッシュを担う。
設計判断の詳細は [ADR 0004](../../docs/adr/0004-github-as-content-source-of-truth.md) を参照。

- 正本 (GitHub): Markdown 本文 (`notes/<slug>.md`) + 画像アセット (`notes/<slug>/<filename>`)
- D1: メタデータインデックス (スラグ、タイトル、公開日、更新日、要約など)
- R2: 原文 Markdown キャッシュ + パース済み MDAST キャッシュ + 画像キャッシュ

### フロントマターでメタデータ管理

Markdown ファイル自体にメタデータを持たせる。vfile-matter でパースし、
NoteTitle / ImageUrl 等の VO に変換する。

```yaml
---
title: 記事タイトル
imageUrl: ./cover.png # 相対パス → アセット API URL に解決される
publishedOn: 2026-01-15
lastModifiedOn: 2026-01-20
visibility: private # 任意。既定は公開
---
```

### 非公開は refresh の時点で弾く

`visibility: private` を書いた記事は同期しない。D1 にも R2 にも載らないため、一覧・
タグ・検索・フィード・sitemap・OGP・原文 Markdown のどこにも現れず、URL を直打ちしても
404 になる。既に同期済みの記事に後から書いた場合は、正本から消えたノートと同じ経路で
D1 と R2 から掃除される。

配信側に除外条件を書き足す方式は採らない。経路が増えるたびに書き漏らし、そのとき漏れる
のは「見せたくないもの」になる。同期しなければ後段はすべて自動的に見えなくなる。

`visibility` を書かなければ公開。`public` / `private` のどちらとも読めない値は、公開せず
スキップとして報告する。公開しないのは、誤って公開する方が誤って隠すより取り返しが
つかないため。それでも `unpublished` に数えないのは、`visibility: pubic` と打ち間違えた
記事は隠すと決めた記事ではないからで、綴りの誤りは誤りとして挙げる。

公開範囲の判定のために原文を読むのは 1 ノートにつき 1 回。contentHash が一致するノートは
読まずに飛ばす。一致するのは前回同期できた = 前回は公開だったノートに限られ、`visibility`
を書き換えればハッシュも変わるので、公開 → 非公開の切り替えは必ず拾える。

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
外部に触れない。取れなければ素のリンクのまま描く。設計判断の詳細は
[ADR 0014](../../docs/adr/0014-link-cards-from-ogp-only.md) を参照。

### 画像はアセット API 経由で配信

Markdown 内の相対パス画像 URL (`./image.png`) を
`/api/v1/notes/<slug>/assets/<path>` に解決する。正本の直接 URL を露出させない。

### 数式は refresh 時に MathML へ組む

本文の `$...$` / `$$...$$` は remark-math で数式ノードにし、**refresh のときに KaTeX の
MathML 出力で組んで MDAST に埋める**。描画側は埋まった MathML を出すだけで、読者に数式
ライブラリは送らない。設計判断の詳細は [ADR 0013](../../docs/adr/0013-math-as-mathml-at-refresh-time.md) を参照。

- KaTeX の既定の HTML 出力は使わない。inline `style` で位置を指定するため CSP 下で崩れる
- 読めない LaTeX は refresh がそのノートをスキップし、理由を返す (fail-loud)
- `$` は数式の開始と見なされる。`$100 と $200` のような書き方は数式になってしまう

### Mermaid のコードフェンスはブラウザで図になる

本文の ` ```mermaid ` は、**読み手のブラウザで** SVG に組んで差し替える。数式と違って
refresh では何も変換しないので、MDAST は素の `code` ノードのまま、force refresh も要らない。
設計判断の詳細は [ADR 0023](../../docs/adr/0023-render-mermaid-in-the-browser.md) を参照。

- Mermaid 本体は動的 import で遅延して読む。**図を使わない記事には降りてこない**
- 組めなかったソースは、書いたままのコードブロックとして残る (記事は壊れない)
- 図が出るまでに一拍あり、JavaScript が動かない環境とクローラーにはソースが届く

### 原文は `/notes/<slug>.md` で取れる

記事ページ (`/notes/<slug>`) の URL 末尾に `.md` を付けると、正本の Markdown を
**そのまま** (フロントマター込み・画像の相対パスも書き換えない) 返す。R2 の原文キャッシュ
から配信し、Hono 側で完結させる (React Router には委譲しない)。設計判断の詳細は
[ADR 0009](../../docs/adr/0009-serve-note-source-markdown-verbatim.md) を参照。

**拡張子なしでも `Accept` で名指しすれば同じものが返る。**

```bash
curl -H 'Accept: text/markdown' https://yantene.net/notes/<slug>
```

`text/markdown` の q 値が `text/html` のそれを厳密に上回ったときだけ原文になる。ブラウザの
Accept は必ず `*/*` を含み、ワイルドカードは Markdown 側に数えないので、記事ページが原文に
化けることはない。判定と、同じ URL が 2 表現を持つことのキャッシュの扱いは
[ADR 0020](../../docs/adr/0020-negotiate-note-source-markdown-on-accept.md) を参照。

## 補助ドメイン

- 将来的な機能追加はノートを中心に拡張する

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
`Path` で `/notes/` に絞り、`Exclude Bots` を付ければ、この計測を入れた目的 (どの記事が
読まれ、どこから来たか) は素の画面で足りる。Country / Host / Path / Referer / Device type /
Browser / OS / Navigation type で絞れる。

**Analytics Dashboards でチャートは組まない。** 素の画面で足りるものを二重に持つと、
片方だけ古びる。

例外は **Referer Path** で、これだけは素の画面に出ない (出るのは Referer Host まで)。
「どのページのリンクから来たか」まで要るときだけ GraphQL API を叩く。

**ここの数と、記事の閲覧数・人気順は別物。** 人気順は D1 側でサーバーが数えたもので
([ADR 0011](../../docs/adr/0011-reader-session-in-kv.md))、母数も除外の仕方も違う。
突き合わせても一致しない。
