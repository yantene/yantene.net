# 0023. Mermaid の図はブラウザで組み、本体は遅延して読む

- Status: Accepted
- Date: 2026-08-15
- Deciders: @yantene

## Context / 背景

記事に図を載せたい。載せ方は Mermaid のコードフェンス (` ```mermaid `) にする。GitHub も
はてなブログも Notion もこの記法をそのまま図として描くので、本文に独自の記法を足さずに済み、
正本のリポジトリを GitHub で開いたときにも図として読める。

このサイトには、似た問題を先に解いた前例がある。数式である。`$...$` は refresh のときに
サーバーで MathML へ組み、MDAST に埋めて配っている ([ADR 0013](0013-math-as-mathml-at-refresh-time.md)、
[0013](0013-math-as-mathml-at-refresh-time.md))。読者に数式ライブラリを送らずに済み、SSR にそのまま
乗るので、クローラーにもフィードにも組み上がった数式が届く。

同じ形を Mermaid にも当てるのが自然に見える。当たらない。理由が 3 つある。

- **Mermaid はブラウザを要求する。** 組版のたびに SVG のテキストを実際に DOM へ置いて
  `getBBox` と `getComputedTextLength` で幅を測り、その実測から節の大きさと辺の経路を決める。
  Workers には DOM が無い。しかも足りないのは DOM の API ではなく、その先の組版である。
  linkedom も jsdom も API は揃えるが実測は返さないので、積んでも動かない。ここが数式と
  分かれる点で、Temml は MathML を吐くだけで組版をブラウザに委ねるから Worker で動く。
  Mermaid は組版そのものをやる道具なので、動かすにはレイアウトエンジンを持つ実物の
  ブラウザが要る
- **重さの桁が違う。** Temml は 1 式あたり 700 バイト程度の MathML を吐いて仕事を終える。
  Mermaid は本体とレイアウトエンジンで 1MB を超え、しかも図の種類ごとに別のパーサを持つ
- **数式と違って、出力が軽くならない。** MathML はテキストのままなので、組んだ結果を
  MDAST に埋めても本文は太らない。Mermaid が返すのは 1 図で数十 KB の SVG で、
  埋めれば R2 の MDAST も、ページに載る loader のデータもその分だけ膨らむ

つまり「重い変換を refresh に寄せて配布を軽くする」という数式の勝ち筋が、そのままでは
成り立たない。改めて選び直す必要がある。

## 検討した選択肢

### どこで図に組むか

- **案 A: refresh のときにサーバーで SVG へ組み、MDAST に埋める (数式と同じ形)**
  - Pros: 読者に JavaScript を送らずに済む。SSR にそのまま乗り、クローラーにも図が届く。
    描画側は埋まった木を出すだけでよい。
  - Cons: **Workers では動かせない。** linkedom などの DOM 実装を積んでも足りない。
    Mermaid が要求するのは `getBBox` と `getComputedTextLength` が返す実測値で、これは
    レイアウトエンジンの仕事だからである。動かすなら Cloudflare Browser Rendering の
    binding を足して refresh からヘッドレスブラウザを叩くことになり、有償の binding が
    1 つ増え、同期経路がブラウザの起動時間に引きずられる。仮に動いたとしても、既存
    ノートへの反映に force refresh が要り、図を 1 つ直すたびに R2 の MDAST を作り直す。
    MDAST に SVG を埋めるぶん、ページに載る loader のデータも太る。
    図が数個の段階で払う代償ではない。
- **案 B: ブラウザで組む (採用)** — `language-mermaid` のコードブロックだけを見つけて、
  クライアントで SVG に差し替える。
  - Pros: MDAST は素の `code` ノードのまま。**refresh の変換処理が 1 つも増えず、既存の
    記事データを作り直す必要もない。** 図を使わない記事は何も余分に払わない。
  - Cons: 図が出るまで 1 テンポ遅れる。JavaScript が動かない環境ではソースのまま残る。
    クローラーには図が届かない (代わりにソースが届く)。
- **案 C: 外部サービスに描かせて `<img>` で貼る** — kroki.io などにソースを渡し、
  返る SVG を画像として貼る。
  - Pros: こちらのバンドルは 1 バイトも増えない。実装がほぼ要らない。
  - Cons: **`img-src 'self' data:` を外部ホストに開くことになる** (ADR 0007)。読者の
    リクエストが第三者に飛び、どの記事の図を誰が見たかがそこに残る。そのサービスが
    止まれば図も消える。このサイトはリンクカードの OGP 取得すら refresh に寄せて
    「読み手のリクエストは外部に触れない」を保っており ([ADR 0014](0014-link-cards-from-ogp-only.md))、
    それを図のために崩す理由がない。

### 本体をどこから読むか

- **案 D: CDN から読む** — unpkg や jsDelivr の `mermaid.esm.min.mjs` を読む。
  - Pros: 自分のバンドルが増えない。
  - Cons: **`script-src` に外部ホストを足すことになる。** ここは nonce と `'self'` だけで
    保っている XSS 緩和の本体で、[ADR 0007](0007-strict-csp-outside-development.md) が「`style-src` は
    緩めても `script-src` は絶対に緩めない」と決めた場所である。図のために開ける口ではない。
- **案 E: npm の `mermaid` をバンドルに含める (採用)**
  - Pros: `script-src 'self'` のまま動く。版がロックファイルで固定され、供給元が差し替わらない。
  - Cons: 自分のバンドルが増える。読み込みの分割を自分で面倒みることになる。

## 決定

案 B と案 E を採る。`language-mermaid` のコードブロックだけをレンダラーで見つけ、
ブラウザ上で Mermaid に組ませる。本体は npm から入れ、動的 import で遅延して読む。

### コードブロックは差し替えず、包む

`mdast-renderer.tsx` の `wrapMermaidBlocks` が、sanitize を通った後の hast を歩いて
`<pre><code class="language-mermaid">` を見つけ、`<mermaid-diagram source="...">` で
**包む** (中の `<pre>` はそのまま子として残す)。描画側の `MermaidDiagram` は、図に
組めるまでと組めなかったときにその子をそのまま出す。

差し替えではなく包むのは、失敗したときに出すべきものが「図にならなかっただけの普通の
コードブロック」だからである。自前で組み直すと、コピーボタンも本文の余白も別物になる。

**包むのは sanitize の後**にする。`mermaid-diagram` を allowlist に足さずに済むので、
本文の生 HTML からこの要素を騙って書くことができない (`<math>` で開いてしまった穴と
同じものを作らない。ADR 0007 の訂正を参照)。

### サーバーではソースを出し、hydration の後で差し替える

`MermaidDiagram` の初回描画はサーバーと同じ (元のコードブロック) で、図への差し替えは
`useEffect` の中でしか始まらない。hydration の食い違いは起きない。

読み込み中の印 (`aria-busy`) を立てるのも、hydration が済んでからにする。サーバーの出力で
立てると、JavaScript が動かない環境では下りる機会が無い。そこでは図に差し替わることも
無いので、支援技術には「永遠に読み込み中」とだけ伝わってしまう。

**本体の取り寄せ口は `mermaid-loader.client.ts` に切り出してある。** React Router は
`*.client.ts` をサーバー側のビルドから外して export を `undefined` に差し替えるので、
`import("mermaid")` が Workers のモジュールグラフに載らない。ここを普通のモジュールにすると、
実行されないコードが 100 本を超えるチャンク (図の種類ごとに分かれる) として Worker に積まれる。

### 読めなければコードブロックに落とす

構文が読めなかった場合も、本体を取り寄せられなかった場合も、落とし先は同じである。
`suppressErrorRendering` を立てて Mermaid が「爆弾」の SVG を差し込むのを止め、例外だけを
受け取ってソースを出す。**図 1 つの誤字で記事全体を壊さない。**

数式が「読めない LaTeX は refresh がノートごとスキップする」(ADR 0013) という強い態度を
採れるのは、そこが公開前の関門だからである。ブラウザで組む以上、失敗は読者の画面で起きる。
そこで本文を消すより、書いたものを見せる方がよい。

**本体の取り寄せに失敗した結果は握り続けない。** 次にマウントされた図が改めて取り寄せる。
React Router の遷移はクライアント側で起きるので、握ったままだと chunk の取得に一度転けた
だけで、そこから図のある別の記事へ回っても図が出ず、読み手がページを読み直すまで直らない。
救えるのは次のマウントからで、同じページに並ぶ図は同じ Promise を掴むため、片方が転べば
両方転ける。

### 締めておくもの

- `securityLevel: "strict"` — ラベルの中の HTML を許さず、`click` によるハンドラ登録も
  無効にする
- SVG を DOM に載せるのは `dangerouslySetInnerHTML` である。Mermaid が返すのが文字列なので
  他に道がない。**本文の sanitize を迂回する唯一の経路になる**が、通るのは本文そのものでは
  なく `securityLevel: "strict"` の Mermaid が同梱の DOMPurify を通して返した出力である
- 図の識別子は `useId()` から記号を落として作る。Mermaid はこの文字列を DOM の id にも
  生成する CSS のセレクタにも使うので、React 19 が返す `«r0»` のような記号が残ると
  読めないセレクタになり、**例外を出さないまま図の配色だけが落ちる**
- ソースが変わったとき用に、描画ごとに番号を足した id を使い、先に始めた描画の結果は
  `AbortController` の合図で捨てる

### CSP は 1 つも広げない (実測)

`pnpm run preview:staging` 相当の構成 (CSP が付くビルド) で図を描かせて確かめた。

- Mermaid は SVG の中に `<style>` を差し込み、SVG 自身にも `style="max-width: 819px"` を
  置く。どちらも `style-src` の `'unsafe-inline'` で通った。**これは数式のために置いたもの**
  (ADR 0007) で、Mermaid のために新しく開けたものではない
- `script-src` は触っていない。ビルド後の Mermaid のチャンクに `eval` も `new Function` も
  1 つも無く、`'unsafe-eval'` は要らない
- 図の描画中に外へ出るリクエストは無い。`img-src` も `connect-src` も広げていない
- 出たディレクティブは変更前と同一で、`csp.test.ts` は 1 行も書き換えていない

### 配色は neutral 固定、字だけ本文に合わせる

`theme: "neutral"` にする。サイトの配色に合わせない。Mermaid は `themeVariables` から
派生色を自分で計算するため `var(--color-primary)` を渡せず、`app.css` の hex を写すと配色が
2 か所に散る。白地の本文には中間色が馴染む。**テーマの出し分けも要らない。** このサイトは
light 固定で、ダークテーマを持たない (`app.css` の daisyUI テーマ `yantene` は
`color-scheme: light`)。

字だけは `fontFamily: "var(--body-font-stack)"` で本文に揃える。ここは色と違って Mermaid が
値を計算せず、生成する CSS にそのまま流すだけなので CSS 変数を渡せる。実測で、図の中の
ラベルが本文と同じ Noto Sans JP で組まれることを確認した。

## 帰結 / Consequences

- 良い面:
  - 本文には Mermaid のソースだけを書けばよい。正本を GitHub で開いても図として読める。
  - MDAST は素の `code` ノードのままなので、**force refresh が要らない。** 既存の記事の
    データにも、refresh の変換処理にも手が入らない。
  - 図を使わない記事が余分に払うのは、記事ページのチャンクの **+2.57 kB (gzip +0.97 kB)**
    だけである (`notes._slug` が 707.27 kB → 709.84 kB)。Mermaid 本体は 115 本の遅延チャンク
    (合計 3,377.5 kB、gzip 960.8 kB) に分かれ、図のある記事を開くまで 1 バイトも降りてこない。
  - Worker のバンドルに Mermaid のチャンクは 1 本も入らない (`server-build` は
    1,313.68 kB → 1,318.94 kB で、増えたのは描画側のコードだけ)。
  - 図が壊れても記事は壊れない。読めないソースはコードブロックとして残る。
- 悪い面・トレードオフ:
  - **図のある記事は重い。** flowchart 1 つと sequence 1 つを置いた記事で、追加のチャンクは
    34 本・857 kB (gzip 223 kB) だった。flowchart だけなら gzip で 194 kB 前後になる。
    Mermaid は図の種類ごとにチャンクを分けるので、種類を増やすほど増える。
  - 図が出るまでに一拍ある。その間はソースが見えている。
  - JavaScript が動かない環境とクローラーには、図ではなくソースが届く。
  - 節の大きさは組んだ時点のフォントで決まる。本文の字は Google Fonts から読むので
    (ADR 0017)、字が届く前に組まれた図はフォールバックの字面で採寸される。
  - 本文の描画で `dangerouslySetInnerHTML` を使う唯一の場所になった。
- 再検討の引き金:
  - この決定が割に合うのは、図を載せる記事が少ないうちだけである。gzip 194 kB は図の
    ある記事だけが払う代償だが、図の載る記事が増えれば、それは「たまに重い記事がある」
    ではなく「このサイトの記事は重い」になる。
  - 次のどれかを踏んだら案 A を選び直す。図を載せる記事がサイトの過半を占めたとき、
    一覧やトップから辿る導線の先が軒並み図を持つようになったとき、あるいは図の種類が
    増えて 1 記事あたりの追加チャンクが gzip 500 kB を超えたとき。
  - そのときの現実的な形は Cloudflare Browser Rendering である。refresh のときに
    ヘッドレスブラウザへ組ませ、返る SVG を R2 に置いて MDAST からは参照だけ持つ。
    MDAST に SVG を埋め込まなければ、loader のデータは太らない。
- 検証方法 / 今後の宣言:
  - `mermaid-diagram.test.tsx` が「`language-mermaid` だけが図の経路に入る」「他の言語は
    従来どおり」「組めなければ元のコードブロックに落ちる」「SSR ではソースのまま」
    「Mermaid に渡す id に記号を混ぜない」「取り寄せに失敗しても次のマウントで取り直す」
    「SSR では読み込み中の印を立てない」を固定する。**Mermaid 本体は差し替えてある**
    (happy-dom に `getBBox` が無く、実物では正しいソースも組めないため)。組版そのものは
    このテストでは見ていない。
  - `csp.test.ts` は変更していない。CSP を広げようとしたらここが落ちる。
  - 図の見た目とテーマは Storybook (`Mdast/MermaidDiagram`) で見る。CSP 下での確認は
    `pnpm run preview:staging` で行う (dev には CSP が付かない)。

## 参考 / More Information

- [Issue #236](https://github.com/yantene/yantene.net/issues/236)
- [ADR 0005](0005-mdast-over-html-rendering.md) — 本文は MDAST のまま運ぶ
- [ADR 0007](0007-strict-csp-outside-development.md) — `script-src` を厳格に保つ
- [ADR 0013](0013-math-as-mathml-at-refresh-time.md) — 数式は refresh 時に組む (対比)
- [ADR 0007](0007-strict-csp-outside-development.md) — `style-src` の `'unsafe-inline'`
- 実装: `app/frontend/components/mdast/mermaid-diagram.tsx` /
  `app/frontend/components/mdast/mermaid-loader.client.ts` /
  `app/frontend/components/mdast/mdast-renderer.tsx` (`wrapMermaidBlocks`) /
  `app/frontend/components/mdast/mdast-renderer.css`
