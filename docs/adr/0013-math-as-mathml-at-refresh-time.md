# 0013. 数式は refresh 時に MathML へ組み、MDAST に埋めて配る

- Status: Accepted
- Date: 2026-08-12
- Deciders: @yantene

## Context / 背景

記事本文の `$...$` と `$$...$$` を数式として組版したい。

MathML Core は 2023 年に Chromium にも載り、3 大ブラウザで揃った。標準的な数式であれば
JavaScript なしで組版できる。読者に数式ライブラリを送らずに済むなら、それが一番軽い。

制約が 2 つある。

- **CSP が `style-src 'self'`** (ADR 0007)。inline `style` 属性はブラウザに丸ごと無視され、
  例外も警告も出ないまま見た目だけが崩れる。位置を style で指定する組版は使えない。
- **サーバーは構造まで作り、描画はフロントが決める** (ADR 0005)。本文は HTML ではなく
  MDAST で渡している。数式もこの経路に乗せたい。

コンテンツは正本 (GitHub) から refresh のときだけ読み直し、MDAST を R2 に置いている
(ADR 0004)。重い変換をここで一度だけ済ませられる場所は既にある。

## 検討した選択肢

### どこで組版するか

- **案 A: クライアントで数式ライブラリを走らせる** — KaTeX / MathJax を読み込み、
  描画時に `$...$` を組む。
  - Pros: 実装が薄い。ライブラリが配るフォントもそのまま使える。
  - Cons: 読者に数百 KB の JS を送る。CSP が `script-src 'self' 'nonce-…'` なので
    外部 CDN は読めず、自前で配る重さがそのまま乗る。SSR しないとクローラーには
    `$...$` のままで届く。
- **案 B: refresh 時にサーバーで組み、MathML を MDAST に埋める** — 変換は同期のときだけ
  走らせ、描画は埋まった木を出すだけにする。
  - Pros: 読者に送る JS が 1 バイトも増えない。SSR に自然に乗るのでクローラーにも数式が
    見える。変換は記事が変わったときにしか走らない。
  - Cons: MDAST の作り方を変えるので、既存ノートへの反映に force refresh が要る。

### 何で LaTeX を MathML にするか

実際に 25 種の式を display / inline の両方で組み、出力を並べて比べた。

- **案 C: KaTeX の `output: "mathml"`** — HTML 出力を捨て、MathML だけを吐かせる。
  - Pros: 出力が組版の意味だけを持つ純粋な MathML になる。50 通りを組んで `style` 属性も
    `class` 属性も 1 つも出なかった。Node 固有 API を使わないので Workers で動く。
  - Cons: HTML 出力ぶんのコードも含んだ依存を積む。
- **案 D: temml** — LaTeX → MathML 専用。KaTeX より後発。
  - Pros: MathML 専用に書かれており、出力が素直とされる。
  - Cons: **inline `style` に頼る。** 50 通りのうち 35 通りが `style` を持ち、
    別行立ては `style="display:block math;"`、行列の桁間は
    `style="padding-left:0em;padding-right:5.9776pt;"` で表される。`tml-*` クラスと
    専用の CSS も要る。このサイトでは属性が黙って捨てられ、組版が崩れる。

### React でどう出すか

- **案 E: hast に載せて既存の sanitize を通す** — MDAST の `data.hName` / `hProperties` /
  `hChildren` に hast を持たせ、`mdast-util-to-hast` に `<math>` として起こさせる。
  - Pros: 他の要素と同じ経路を通る。sanitize の一貫性が保てる。
  - Cons: MathML のタグ・属性を allowlist に足す必要がある。
- **案 F: `dangerouslySetInnerHTML` で流し込む** — MathML の文字列をそのまま渡す。
  - Pros: 実装が短い。
  - Cons: 本文の描画だけが sanitize を迂回する。`mdast-renderer` は URL スキームの
    sanitize や iframe の src 正規化を入れており、「自分が書いたものだから安全」で
    素通しにしない方針を採っている。そこに穴を開ける。

## 決定

**案 B・案 C・案 E を採る。**

`remark-math` で `$...$` / `$$...$$` を `inlineMath` / `math` ノードにし、refresh のときに
KaTeX の MathML 出力で組んで、結果の hast を `data.hChildren` に埋める
(`services/latex-to-mathml.ts` と `services/note-content-parser.ts`)。R2 に置く MDAST は
この時点で `<math>` を含んでいる。描画側は埋まった木を出すだけで、数式ライブラリは
クライアントに届かない。

KaTeX の `trust` は既定の `false` のままにする。`true` にすると `\href` や
`\includegraphics` が開き、本文から URL や class を差し込めるようになって、
描画側の allowlist が意味を失う。

`rehypeSanitize` の schema には MathML のタグと、組版の意味しか持たない属性だけを足す
(`components/mdast/mathml.ts`)。URL・スクリプト・inline style を運べるものは入れない。
`href` も `class` も `id` も外し、外部の画像を読む `mglyph` も入れない。MathML の子要素は
`ancestors` で `<math>` の中に限る。

**読めない LaTeX は送出する。** `MathSyntaxError` として上げ、refresh はそのノートだけを
スキップして理由を返す。赤字を出したまま公開してしまうと、書き手が誤りに気づけない。
refresh 全体は落とさない。数式 1 つの誤字で他のノートまで同期されなくなる。

**フォントは配らない。** MathML の組版は OpenType の MATH テーブルに依存する。
Latin Modern Math を配れば環境差は消えるが 400KB 前後あり、数式ライブラリを避けた意味が
薄れる。まずは環境任せで出す。

## 帰結 / Consequences

- 良い面: 読者に送る JavaScript が増えない。SSR にそのまま乗るので、クローラーにも
  フィードにも組み上がった数式が届く。変換は refresh のときだけ走り、通常のリクエストは
  R2 から読むだけで済む。sanitize を迂回する経路を作らずに済む。
- 悪い面・トレードオフ:
  - 数式フォントは環境任せ。Windows は Cambria Math が標準で入っており概ね綺麗に出るが、
    Latin Modern Math も STIX Two Math も無い Linux では一部の記号が豆腐になる。
  - MathML には折り返しが無い。本文より長い式はその場で横スクロールさせる。
  - `$` が数式の開始と見なされる。`$100 と $200` のように通貨として 2 つ書くと、
    その間が数式として組まれる。避けるにはインラインコードか `\$` で書く。
  - MDAST の作り方を変えたので、デプロイ後に一度 force refresh が要る。
    流すまで既存ノートの `$...$` は素の文字列のまま出る。
- 検証方法: `latex-to-mathml.test.ts` が、代表的な式で `style` / `class` 属性を 1 つも
  出さないこと・`\href` が効かないことを固定する。`mdast-renderer.test.tsx` が、
  allowlist の外の属性と要素が落ちること・`<math>` の外の MathML 要素が残らないことを
  固定する。

## 参考 / More Information

- [Issue #174](https://github.com/yantene/yantene.net/issues/174)
- [ADR 0005](0005-mdast-over-html-rendering.md) — MDAST でフロントエンドに渡す
- [ADR 0007](0007-strict-csp-outside-development.md) — inline style が効かない理由
- [MathML fonts](https://developer.mozilla.org/en-US/docs/Web/MathML/Guides/Fonts) —
  数式フォントと環境ごとの差
