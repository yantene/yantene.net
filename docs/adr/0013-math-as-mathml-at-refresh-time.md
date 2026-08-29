# 0013. 数式は refresh 時に Temml で MathML へ組み、MDAST に埋めて配る

- Status: Accepted
- Date: 2026-08-13
- Deciders: @yantene

## Context / 背景

記事本文の `$...$` と `$$...$$` を数式として組版したい。

MathML Core は 2023 年に Chromium にも載り、3 大ブラウザで揃った。標準的な数式であれば
JavaScript なしで組版できる。読者に数式ライブラリを送らずに済むなら、それが一番軽い。

制約がある。**サーバーは構造まで作り、描画はフロントが決める**
([ADR 0005](0005-mdast-over-html-rendering.md))。本文は HTML ではなく MDAST で渡している。
数式もこの経路に乗せたい。

コンテンツは正本 (GitHub) から refresh のときだけ読み直し、MDAST を R2 に置いている
([ADR 0004](0004-github-as-content-source-of-truth.md))。重い変換をここで一度だけ
済ませられる場所は既にある。

## 検討した選択肢

### どこで組版するか

- **案 A: クライアントで数式ライブラリを走らせる** — KaTeX / MathJax を読み込み、
  描画時に `$...$` を組む。
  - Pros: 実装が薄い。ライブラリが配るフォントもそのまま使える。
  - Cons: 読者に数百 KB の JS を送る。CSP が `script-src 'self' 'nonce-…'` なので
    外部 CDN は読めず、自前で配る重さがそのまま乗る。SSR しないとクローラーには
    `$...$` のままで届く。
- **案 B: refresh 時にサーバーで組み、MathML を MDAST に埋める (採用)** — 変換は同期の
  ときだけ走らせ、描画は埋まった木を出すだけにする。
  - Pros: 読者に送る JS が 1 バイトも増えない。SSR に自然に乗るのでクローラーにも数式が
    見える。変換は記事が変わったときにしか走らない。
  - Cons: MDAST の作り方を変えるので、既存ノートへの反映に force refresh が要る。

### 何で LaTeX を MathML にするか

実際に 25 種の式を display / inline の両方で組み、出力を並べて比べた。

- **案 C: KaTeX の `output: "mathml"`** — HTML 出力を捨て、MathML だけを吐かせる。
  - Pros: Node 固有 API を使わないので Workers で動く。実績が厚い。
  - Cons: **KaTeX の MathML 出力は「HTML 出力の添え物」で、単体で読ませる前提が無い。**
    関数名の後ろの空きが詰まるなど、視覚描画としての詰めが甘い箇所が残る。
- **案 D: [Temml](https://temml.org/) (採用)** — KaTeX と同じ作者による、
  **MathML だけで視覚描画する前提**のライブラリ。
  - Pros: MathML 単体で読ませることを目的に作られているので、組版の質が高い。
    数式番号・`\boxed` の枠・`\begin{array}` の縦罫線が正しく出る。
  - Cons: **表組みの桁や数式番号の位置を inline style で渡してくる。**
    MathML Core が `mtable` の presentation attribute を削ったため、CSS でしか
    表せないものが残っているからで、上流の作りとして正しい。

## 決定

**案 B と案 D を採る。`remark-math` で `$...$` / `$$...$$` を `inlineMath` / `math` ノードに
し、refresh のときに Temml で組んで、結果の hast を `data.hChildren` に埋める**
(`services/latex-to-mathml.ts` と `services/note-content-parser.ts`)。R2 に置く MDAST は
この時点で `<math>` を含んでいる。描画側は埋まった木を出すだけで、数式ライブラリは
クライアントに届かない。

**Temml が出す inline style はそのまま通す。** そのために `style-src` へ `'unsafe-inline'`
を置いた ([ADR 0007](0007-strict-csp-outside-development.md))。inline style を MathML の中へ
移し替える後処理も書いてみたが、`latex-to-mathml.ts` が 114 行から 370 行に膨らみ、うち
232 行が後処理という状態になったので捨てた。判断の詳細と、通る経路をそれでも塞がない
理由は ADR 0007 が持っている。**ここに写しを置かない** (かつて写しを置いて、片方だけ
直され食い違った)。

### sanitize は緩めない

`rehypeSanitize` の schema には MathML のタグと、組版の意味しか持たない属性だけを足す
(`components/mdast/mathml.ts`)。URL・スクリプトを運べるものは入れない。`href` も `class` も
`id` も外し、外部の画像を読む `mglyph` も入れない。MathML の子要素は `ancestors` で
`<math>` の中に限る。

Temml の `trust` は既定の `false` のままにする。`true` にすると `\href` や
`\includegraphics` が開き、本文から URL や class を差し込めるようになって、描画側の
allowlist が意味を失う。

### 読めない LaTeX は送出する

`MathSyntaxError` として上げ、refresh はそのノートだけをスキップして理由を返す。
赤字を出したまま公開してしまうと、書き手が誤りに気づけない。refresh 全体は落とさない。
数式 1 つの誤字で他のノートまで同期されなくなる。

### フォントは配らない

MathML の組版は OpenType の MATH テーブルに依存する。数式用の書体は Google Fonts から
読む ([ADR 0017](0017-webfonts-from-google-fonts.md))。ライブラリ付属のフォントを
自前で束ねて配ることはしない。数式ライブラリを避けた意味が薄れる。

## 帰結 / Consequences

- 良い面
  - 読者に送る JavaScript が 1 バイトも増えない。SSR に自然に乗り、クローラーにも
    数式が構造として届く。
  - 変換は refresh のときだけ走るので、読み手のリクエストは軽い。
  - 数式番号・`\boxed` の枠・`\begin{array}` の縦罫線・`\mathllap` の重ね合わせが出る。
  - Temml が値や書き方を変えても、こちらは何もしなくてよい。
- 悪い面・トレードオフ
  - **MDAST の作り方を変えたので、既存ノートへの反映には force refresh が要る。**
    流すまで既存ノートの `$...$` は素の文字列のまま出る。
  - `$` は数式の開始と見なされる。`$100 と $200` のような書き方は数式になってしまう。
  - 数式の見た目は読者の環境の MATH フォントに左右される。
  - `style-src` を緩めた代償は ADR 0007 に書いてある。
- 検証方法 / 今後の宣言
  - `latex-to-mathml.test.ts` が組版の結果と `MathSyntaxError` の送出を固定する。
  - 要約は数式ノードを除いたテキストから切り出す。ノードが持つ値は LaTeX 原文なので、
    残すと `\frac{a}{b}` のような制御綴りが一覧や OGP にそのまま出る。

## 参考 / More Information

- [Temml](https://temml.org/)
- [MathML Core](https://www.w3.org/TR/mathml-core/)
- [#174](https://github.com/yantene/yantene.net/issues/174) /
  [#208](https://github.com/yantene/yantene.net/issues/208)
