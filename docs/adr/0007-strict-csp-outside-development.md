# 0007. CSP は development でのみ外し、`script-src` は厳格・`style-src` は数式のため緩める

- Status: Accepted
- Date: 2026-08-09
- Deciders: @yantene

## Context / 背景

ノート本文は外部リポジトリ由来の Markdown をレンダリングするため、XSS 緩和としての CSP は
実利がある。一方で CSP には、開発と数式の両方で無理が出る場所があった。

### `style-src 'self'` は inline style を黙って落とす

`style-src 'self'` のとき **ブラウザは inline `style` 属性を丸ごと無視する**。nonce は要素
(`<style>` / `<script>`) にしか付けられず属性には効かないため、`style={...}` で渡した値は
必ず消える。しかも例外も警告も出ず、ただ見た目が消える。これを知らずに書いたコードが
繰り返し壊れた。

- Celestim (トップページの天体アニメ) が CSS 変数を `style` 属性で渡していたため、
  初回コミットから一度も描画されていなかった ([#78](https://github.com/yantene/yantene.net/issues/78))
- タグクラウドの文字サイズ強弱が同じ理由で効いていなかった ([#80](https://github.com/yantene/yantene.net/issues/80))

いずれも**単体テストでは検知できず、CSP ヘッダが付いた環境でしか露見しない**。

### CSP を全環境で強制すると開発が成立しない

Vite の dev サーバーは HMR のために CSS を inline `<style>` として注入する (`updateStyle`)。
これは Vite の設計そのもので回避手段がなく、`style-src 'self'` とは原理的に両立しない。

```
Applying inline style violates the following Content Security Policy directive 'style-src 'self''.
updateStyle @ client:1070
```

CSS が丸ごとブロックされ、dev で見た目の確認ができなくなる。スタイル崩れを実装のバグと
誤認する事故も誘発する。

### 数式の組版が `style-src 'self'` と噛み合わない

数式は refresh 時に MathML へ組んで MDAST に埋めている
([ADR 0013](0013-math-as-mathml-at-refresh-time.md))。組版に使う Temml は、**表組みの桁や
数式番号の位置を inline style で渡してくる。** MathML Core が `mtable` の presentation
attribute を削ったため、CSS でしか表せないものが残っているからで、上流の作りとして正しい。

`style-src 'self'` の下ではブラウザがそれを丸ごと無視するので、そのままでは行列や `cases` の
桁が崩れる。避けるには inline style を MathML の中へ移し替える後処理が要る。実際に書いた。

**結果は割に合わなかった。**

|                                 | 後処理なし      | 後処理あり                     |
| ------------------------------- | --------------- | ------------------------------ |
| `latex-to-mathml.ts`            | 114 行 / 関数 4 | **370 行 / 関数 12**           |
| うち後処理                      | —               | 232 行                         |
| 対応表                          | なし            | 14 エントリ (うち「落とす」10) |
| 数式番号・`\boxed` の枠・縦罫線 | 出る            | **出ない**                     |
| 上流が値を変えたら              | 何も要らない    | 追随が要る                     |

「落とす」対象は `\mathllap` や `\begin{CD}` を試すたびに増え、リストに無いものは式ごと
飛ばす作りだった。目的 (LaTeX を組む) より手段 (CSP を避ける) のほうが大きい。

## 検討した選択肢

### CSP を付ける範囲

- **案 A: 全環境で厳格な CSP** — dev で CSS が落ちて見た目を確認できない。
- **案 B: 全環境で `'unsafe-inline'`** — 本番の XSS 緩和を捨てることになる。
- **案 C: dev だけ `'unsafe-inline'`** — dev と本番で許可が変わり、dev で通ったものが
  本番で落ちる。しかも落ち方が無音。
- **案 D: dev では CSP を付けない (採用)** — 違いが「有る／無い」になるので、
  「dev では CSP を検証していない」と言い切れる。確認は `preview:staging` で行う。

### `style-src` で inline style をどう扱うか

- **案 A: 後処理を続ける** — 上の表のとおり。装飾が出ず、上流に追随し続ける必要がある。
- **案 B: `class` を allowlist に通し、値ごとにクラスを起こす** — **さらに複雑になる。**
  実装のマップ・CSS・allowlist の 3 箇所を揃え続ける必要があり、Temml が新しい値を出す
  たびに全部直す。実測では `padding` の値だけで 7 種類あり、`\begin{smallmatrix}` を
  足しただけで新しい値が出た。`\color{任意}` は値が無限なのでそもそもクラスにできない。
- **案 C: `style-src` にだけ `'unsafe-inline'` を置く (採用)** — 後処理が丸ごと消える。
  装飾も出る。上流の変化に追随不要。引き換えに CSS injection を CSP で止められなくなる。

## 決定

**CSP は `APP_ENV === "development"` のときだけ付けない。`script-src` は nonce 方式のまま
厳格に保ち、`style-src` にだけ `'unsafe-inline'` を置く。**

### `script-src` は絶対に緩めない

**ここが本 ADR の要。** XSS 緩和の本体は `script-src` であって、そちらは nonce 方式のまま
保つ。`app/backend/csp.test.ts` が「`script-src` に `'unsafe-inline'` / `'unsafe-eval'` が
入らないこと」「nonce が付いていること」を全環境で固定する。

`app/backend/index.ts` の `secureHeaders` が `default-src 'self'` /
`script-src 'nonce-…' 'self'` / `style-src 'self' 'unsafe-inline'` /
`img-src 'self' data:` / `frame-ancestors 'none'` などを出す。埋め込み動画のホストだけは
`frame-src` に列挙してあり、描画側 (`mdast-renderer` / `embed.ts`) が src を同じホストへ
正規化しているので両者は対で動く。

- コンポーネント CSS は `app.css` に `@import` で束ねる。`import "./x.css"` を JS から
  行うと `<style>` 注入になるため。`app.css` は `<link>` で届く。
- 自前で出す inline `<script>` には `c.get("secureHeadersNonce")` の nonce を付ける。

### CSP を付ける範囲

`APP_ENV === "development"` のときだけ CSP ヘッダーを付けない。それ以外
(staging / production、および想定外の値) では必ず付ける (secure by default)。
CSP 以外のセキュリティヘッダー (HSTS / X-Frame-Options / Referrer-Policy /
Permissions-Policy) は全環境で共通に付ける。

### 数式以外に inline style は入らない

CSP はブラウザ側の許可でしかない。**こちらの sanitize は緩めていない。**
`style` を通すのは MathML の要素だけで (`components/mdast/mathml.ts`)、本文の段落・見出し・
リンクには従来どおり入らない (rehype-sanitize の既定が落とす)。

ただし MathML なら、Temml が組んだものとは限らない。本文の生 HTML は既定では捨てるが、
iframe か audio を含むブロックだけは丸ごと通すので
(`components/mdast/mdast-renderer.tsx` の `keepEmbedHtml`。音源については
[ADR 0022](0022-bake-midi-into-opus-and-serve-audio-assets.md))、埋め込みや音源と同じ
ブロックに `<math style="...">` を並べれば、その inline style は落ちずに出る。`<mi>` の
ような中身は ancestors で `<math>` の下に縛ってあるが、`<math>` 自身はトップレベルに
現れるので縛れない。

つまり inline style が通る経路は 2 つ、refresh 時に Temml が組んだ MathML と、埋め込みか
音源のある記事に書き手が直に書いた `<math>` である。後者を塞がないのは、そこを通れるのが
書き手自身しかいないためである。

### 危険度の見積もり

- 本文の正本は自分のリポジトリで、外部からの投稿経路がない (Webmention はテキストのみ)。
  手書きの `<math style="...">` を置けるのも、そこへ push できる人間だけである
- `img-src` は `'self' data:` のままなので、CSS からの外部への送信口が塞がっている
- ただし `font-src` に Google Fonts を開けてある ([ADR 0017](0017-webfonts-from-google-fonts.md))
  ので、CSS を注入できる攻撃者は `@font-face` + `unicode-range` で文字単位のリクエストを
  飛ばせる。本文に機密の入力欄が無いので実害は考えにくいが、**フォームを置くときは
  この判断を見直すこと。**

### 見た目の可変軸は、規約として静的なクラスで持つ

CSP が止めなくなっても、自前のコードで連続値を `style` 属性に流す書き方は避ける。

- 見た目の可変軸は**静的な CSS のクラスの段階**として持つ
  (例: タグクラウドの大小は 6 段階のクラス、季節色は段階のクラス)。
- **連続値が要るときは Web Animations API か SVG の presentation attribute を使う。**
  段階で表せない軸に出会ったら、まずこの 2 つを検討する
  ([ADR 0008](0008-interactive-day-clock-via-web-animations-api.md))。

**ただしこれは規約であって、機械は止めない。** 以前は ESLint の `react/forbid-dom-props` が
弾いていたが、Oxlint に同等のルールが無く、1 ルールのために ESLint 一式を維持する額と
釣り合わないと判断して落とした ([ADR 0027](0027-lint-with-oxlint-and-drop-inline-style-enforcement.md))。
守るのは人であって道具ではない。

### dev で露見しない穴をどう埋めるか

- **CSP に関わる変更 (inline script / 外部リソースの追加) をしたら、
  `pnpm run preview:staging` で必ず確認する。** `pnpm run preview` では確認できない
  (`CLOUDFLARE_ENV` を指定しないビルドなので `APP_ENV=development` になり CSP が付かない)。
  Storybook にも CSP は無いので確認には使えない。
- 確認の目安は、CSP ヘッダーの `nonce-...` と HTML の `<script nonce="...">` が
  同一リクエスト内で一致していること。

## 帰結 / Consequences

- 良い面
  - 本番の XSS 緩和 (`script-src`) が保たれたまま、dev で見た目が正しく確認できる。
  - `latex-to-mathml.ts` が 370 行 → 140 行、関数 12 → 4 に戻った。後処理の対応表・
    契約テスト・CSS の打ち消しがすべて不要になった。
  - 数式番号・`\boxed` の枠・`\begin{array}` の縦罫線・`\mathllap` の重ね合わせが出る。
  - Temml が値や書き方を変えても、こちらは何もしなくてよい。
- 悪い面・トレードオフ
  - CSP 違反が dev で露見しない。`preview:staging` まで見つからない。
  - **CSS injection を CSP で止められない。** 上の「危険度の見積もり」の前提が崩れたら
    (フォームを置く、外部からの投稿経路を作る) この判断を見直すこと。
  - 見た目の可変軸に連続値が使えない場面がある。タグクラウドは 6 段階に離散化した。
  - コンポーネント CSS の co-location が弱まる。`x.tsx` の隣に `x.css` は置くが、
    読み込みは `app.css` 経由になる。
  - サードパーティのコンポーネントが nonce を受け取れない場合、自前で書き直す必要がある。
- 検証方法 / 今後の宣言
  - `app/backend/csp.test.ts` が「development では付かない」「staging / production および
    未知の `APP_ENV` では付く」「他のヘッダーは全環境で付く」「`script-src` が緩んでいない」
    を検証する。CSP を環境で分岐させる実装を変えたら、このテストを必ず通すこと。

### dev だけで出るコンソールエラー

`A tree hydrated but some attributes ... didn't match` — React Router の dev 専用
critical CSS (`data-react-router-critical-css`) が `nonce=""` の `<link>` を出す一方、
クライアント側の context には nonce が入らないため。本番の HTML にはこの `<link>` 自体が
存在しないので発生しない。**本番ビルドで再現しなければ追わなくてよい。**
