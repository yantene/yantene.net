# 0018. 数式は Temml で組み、inline style は MathML の中へ移す

- Status: Accepted
- Date: 2026-08-14
- Deciders: @yantene

## Context / 背景

[ADR 0013](0013-math-as-mathml-at-refresh-time.md) で、数式を refresh 時に MathML へ組んで
MDAST に埋めると決め、変換には KaTeX の MathML 出力を使っていた。

**この選択には見落としがあった。KaTeX の MathML はスクリーンリーダー向けの意味の層で、
視覚描画用ではない。** KaTeX 本体の CSS がそう書いている。

```css
/* node_modules/katex/dist/katex.css */
.katex .katex-mathml {
  /* Accessibility hack to only show to screen readers */
  position: absolute;
  clip-path: inset(50%);
}
```

見た目は HTML (span + inline style) の側が担い、MathML は画面から隠される。その HTML 出力は
inline style で位置を指定するので CSP と両立せず ([ADR 0007](0007-strict-csp-outside-development.md))、
0013 で捨てた。結果として**視覚描画に使う想定のないものを視覚描画に使っていた。**

症状は組版の欠落として出る。`\log w(t)` が `logw(t)` と地続きに組まれる。KaTeX は関数名の
後ろに不可視の関数適用 (U+2061) を置くが、MathML Core の operator dictionary はその
lspace / rspace を **0 と定めている**。TeX が入れる thin space (3/18 em) は MathML には
引き継がれない。**ブラウザのバグではないので、描画側で待っていても直らない。**

## 検討した選択肢

手元の Chrome で 4 通りを実測した。

|                  | 出力   | 関数名のアキ | `style` 属性      | 1 式のサイズ | 数式フォント |
| ---------------- | ------ | ------------ | ----------------- | ------------ | ------------ |
| KaTeX (それまで) | MathML | ✗ 詰まる     | 0 個              | 469 B        | 要           |
| MathJax          | MathML | ✗ 詰まる     | ほぼ 0 個         | ~500 B       | 要           |
| **Temml**        | MathML | ✓            | 多数 (後処理する) | ~700 B       | 要           |
| MathJax          | SVG    | ✓            | 1 個              | 9.2 KB       | 不要         |

- **案 A: KaTeX のまま、足りない組版を自前で補う**
  - Pros: 依存を増やさない。見た目の差は小さい (12 パターンで幅を突き合わせると 10 が一致し、
    差は関数名と `cases` だけだった)。
  - Cons: TeX の組版規則を自分で持つことになる。関数名を直せば次は別の箇所、と際限がない。
    さらに mtable の間隔は KaTeX が `columnspacing="0em 1em 0em"` のような**列ごとのリスト**で
    出すのに Chrome はそれを見ない (MathML Core が presentation attribute を削ったため)。
    CSS へ移すには自分で列ごとに展開する必要があり、列数は式によって変わる。
- **案 B: MathJax の MathML 出力へ移る**
  - Pros: `style` をほとんど出さない。
  - Cons: **見た目は直らない。** MathJax も MathML を意味の層として扱っており、関数名のアキが
    入らない。移る意味がない。
- **案 C: MathJax の SVG 出力へ移る**
  - Pros: 組版は 4 つの中で最も良い。`style` は `vertical-align` の 1 個だけ。数式フォントが
    要らなくなる (path で描くため)。色は `currentColor` で本文に追随する。
  - Cons: 数式が画像相当になる。文字を選択・検索できず、読み上げに別の手当てが要る。
    1 式 9.2KB。
- **案 D: Temml へ移り、inline style を MathML の中へ移す (採用)**
  - Pros: 組版は上流が持つ。関数名のアキは `<mspace width="0.1667em"/>` として正規に出てくる。
    mtable の空きも**セルごとに展開済み**で出るので、こちらは置き換えるだけで済む。
    数式はテキストのまま残る。
  - Cons: Temml の出力形式に依存する後処理を持つことになる。上流が変わると静かに壊れる。

## 決定

案 D を採用する。変換を [Temml](https://temml.org/) に差し替える (KaTeX と同じ作者による、
**MathML だけで視覚描画する前提**のライブラリ)。

**Temml が出す inline style はそのまま通す。** そのために `style-src` へ
`'unsafe-inline'` を置いた ([ADR 0019](0019-inline-style-for-math.md))。

当初は inline style を MathML の中へ移し替える後処理を書いた (`padding` を `<mspace>` に、
`color` を `mathcolor` に、表せないものは落とす)。動きはしたが、**そのために
`latex-to-mathml.ts` が 114 行から 370 行に膨らみ、うち 232 行が後処理だった。**
目的 (LaTeX を組む) より手段 (CSP を避ける) のほうが大きい状態で、しかも

- 落とす対象のリストが `\mathllap` や `\begin{CD}` を試すたびに増えた
- 落とすと数式番号・`\boxed` の枠・`\begin{array}` の縦罫線が出ない
- Temml が値を変えるたびに追随が要る

という負債を抱えていた。CSP を緩めたことでこれが全部消え、実装は 140 行・関数 4 つに戻った。

### 数式以外に inline style は入らない

CSP を緩めても、**本文の段落や見出しに inline style が入るわけではない。**
sanitize の allowlist で `style` を通すのは MathML の要素だけにしてある
(`components/mdast/mathml.ts`)。本文の生 HTML は iframe 以外が落ちるので、そもそも
書き手が MathML を直に書くこともできない。

## 参考 / More Information

- [ADR 0013](0013-math-as-mathml-at-refresh-time.md) — 数式を refresh 時に MathML へ組む
- [ADR 0007](0007-strict-csp-outside-development.md) — inline style が CSP に無視される
- [ADR 0017](0017-webfonts-from-google-fonts.md) — 数式の字 (STIX Two Math)
- [#208](https://github.com/yantene/yantene.net/issues/208)
- 実装: `app/backend/services/latex-to-mathml.ts` /
  `app/frontend/components/mdast/mdast-renderer.css` (mtd の打ち消し)
