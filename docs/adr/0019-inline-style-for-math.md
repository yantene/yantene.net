# 0019. `style-src` に `'unsafe-inline'` を置き、`script-src` は厳格なまま保つ

- Status: Accepted
- Date: 2026-08-14
- Deciders: @yantene

## Context / 背景

[ADR 0007](0007-strict-csp-outside-development.md) で「CSP に `'unsafe-inline'` を足さない」と
決めた。XSS 緩和を保つためで、`script-src` についてはいまも正しい。一方 `style-src` の側は、
数式の組版で無理が出た。

数式は refresh 時に MathML へ組んで MDAST に埋めている ([ADR 0013](0013-math-as-mathml-at-refresh-time.md))。
組版には Temml を使うが ([ADR 0018](0018-typeset-math-with-temml.md))、**Temml は表組みの桁や
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

- **案 A: 後処理を続ける (ADR 0007 のまま)**
  - Pros: CSP を一切緩めない。
  - Cons: 上の表のとおり。装飾が出ず、上流に追随し続ける必要がある。
- **案 B: `class` を allowlist に通し、値ごとにクラスを起こす**
  - Pros: 装飾も出せる。
  - Cons: **さらに複雑になる。** 実装のマップ・CSS・allowlist の 3 箇所を揃え続ける必要が
    あり、Temml が新しい値を出すたびに全部直す。実測では `padding` の値だけで 7 種類あり、
    `\begin{smallmatrix}` を足しただけで新しい値が出た。`\color{任意}` は値が無限なので
    そもそもクラスにできない。
- **案 C: `style-src` にだけ `'unsafe-inline'` を置く (採用)**
  - Pros: 後処理が丸ごと消える。装飾も出る。上流の変化に追随不要。
  - Cons: CSS injection を CSP で止められなくなる。ADR 0007 が支えていた
    「見た目の可変軸は静的なクラスの段階で持つ」規律の強制力が弱まる。

## 決定

案 C を採用する。`style-src` に `'unsafe-inline'` を置く。

### `script-src` は絶対に緩めない

**ここが本 ADR の要。** XSS 緩和の本体は `script-src` であって、そちらは nonce 方式のまま
保つ。`app/backend/csp.test.ts` が「`script-src` に `'unsafe-inline'` / `'unsafe-eval'` が
入らないこと」「nonce が付いていること」を全環境で固定する。

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
書き手自身しかいないためである (次節)。

### 危険度の見積もり

- 本文の正本は自分のリポジトリで、外部からの投稿経路がない (Webmention はテキストのみ)。
  手書きの `<math style="...">` を置けるのも、そこへ push できる人間だけである
- `img-src` は `'self' data:` のままなので、CSS からの外部への送信口が塞がっている
- ただし `font-src` に Google Fonts を開けてある ([ADR 0017](0017-webfonts-from-google-fonts.md))
  ので、CSS を注入できる攻撃者は `@font-face` + `unicode-range` で文字単位のリクエストを
  飛ばせる。本文に機密の入力欄が無いので実害は考えにくいが、**フォームを置くときは
  この判断を見直すこと。**

### ADR 0007 との関係

0007 の決定のうち **`style-src` に関する部分は本 ADR で置き換える**。`script-src` を厳格に
保つ部分、development でのみ CSP を外す部分は変わらない。

`app/frontend/**/*.tsx` の `style` 属性禁止 (ESLint の `react/forbid-dom-props`) は
**残す**。CSP が止めなくなっても、見た目の可変軸を静的なクラスの段階で持つ書き方は続ける。
規律を CSP に肩代わりさせていたのをやめ、lint で明示的に守る形にした、と考える。

## 帰結 / Consequences

- 良い面:
  - `latex-to-mathml.ts` が 370 行 → 140 行、関数 12 → 4 に戻った。後処理の対応表・
    契約テスト・CSS の打ち消しがすべて不要になった。
  - 数式番号・`\boxed` の枠・`\begin{array}` の縦罫線・`\mathllap` の重ね合わせが出る。
  - Temml が値や書き方を変えても、こちらは何もしなくてよい。
- 悪い面・トレードオフ:
  - CSS injection を CSP で止められない。sanitize が第一の防壁になる。
  - inline style が「本番で静かに消える」ことがなくなったぶん、CSP が教えてくれていた
    設計上の誤り (Celestim やタグクラウドの事故) は lint でしか気づけない。
- 検証方法 / 今後の宣言:
  - `app/backend/csp.test.ts` が `script-src` の厳格さを全環境で固定する。**緩めるときは
    必ずここが落ちる。**
  - `app/frontend/components/mdast/mdast-renderer.test.tsx` が「`style` を通すのは MathML の
    要素だけ」「URL・スクリプトを運ぶ属性は通さない」を固定する。
  - 外部リソースや inline に関わる変更をしたら `pnpm run preview:staging` で確認すること
    (dev には CSP が付かない)。

## 訂正 (2026-08-14)

**本 ADR は production 公開後に本文を書き換えた。** `.claude/rules/adr.md` の不変性 (公開後は
Accepted な ADR の本文を書き換えない) に対する例外である。

書き換えたのは決定ではなく、「数式以外に inline style は入らない」節に書いた実装の説明である。
公開時点では「本文の生 HTML は iframe 以外が落ちるので、書き手が MathML を直に書いて `style` を
差し込むこともできない」としていたが、これは誤りだった。埋め込みと同じ生 HTML のブロックに
`<math style="...">` を並べれば通る。防御の根拠として誤った記述を残すほうが害が大きいため、
追記ではなく本文の訂正で処理した。決定 (`style-src` にだけ `'unsafe-inline'` を置く) は
変えていない。

## 訂正 (2026-08-15)

**再び本文を書き換えた。** 前節と同じく不変性に対する例外である。

書き換えたのは同じ「数式以外に inline style は入らない」節の、生 HTML を通す条件である。
公開時点では iframe を含むブロックだけを通していたが、
[ADR 0022](0022-bake-midi-into-opus-and-serve-audio-assets.md) で `<audio>` が加わり、
`keepEmbedHtml` は iframe **または** audio を含むブロックを通すようになった。前節の訂正と
違って、この記述は書いた時点では正しく、実装が変わって古びたものである。

それでも追記ではなく本文の訂正で処理したのは、ここが inline style の通る経路 (つまり
防御の範囲) を説明する箇所だからである。本文が実態より狭い範囲を指したままだと、次に
この判断へ触る人へ誤った前提を渡す。決定は変えていない。

## 参考 / More Information

- [ADR 0007](0007-strict-csp-outside-development.md) — `style-src` の扱いは本 ADR で置き換え
- [ADR 0013](0013-math-as-mathml-at-refresh-time.md) — 数式を refresh 時に MathML へ組む
- [ADR 0018](0018-typeset-math-with-temml.md) — 組版を Temml に移す
- [#208](https://github.com/yantene/yantene.net/issues/208)
- 実装: `app/backend/index.ts` (CSP) / `app/frontend/components/mdast/mathml.ts` (allowlist)
