# 0007. CSP に `'unsafe-inline'` を足さず、development でのみ CSP を外す

- Status: Accepted
- Date: 2026-08-08
- Deciders: @yantene

## Context / 背景

ノート本文は外部リポジトリ由来の Markdown をレンダリングするため、XSS 緩和としての CSP は
実利がある。一方で `'unsafe-inline'` を含まない CSP は、開発者が気づきにくい形で見た目を壊す。

`style-src 'self'` のとき **ブラウザは inline `style` 属性を丸ごと無視する**。nonce は要素
(`<style>` / `<script>`) にしか付けられず属性には効かないため、`style={...}` で渡した値は
必ず消える。しかも例外も警告も出ず、ただ見た目が消える。これを知らずに書いたコードが
繰り返し壊れた。

- Celestim (トップページの天体アニメ) が CSS 変数を `style` 属性で渡していたため、
  初回コミットから一度も描画されていなかった ([#78](https://github.com/yantene/yantene.net/issues/78))
- タグクラウドの文字サイズ強弱が同じ理由で効いていなかった ([#80](https://github.com/yantene/yantene.net/issues/80))

いずれも**単体テストでは検知できず、CSP ヘッダが付いた環境でしか露見しない**。

さらに、CSP を全環境で強制すると開発が成立しない。Vite の dev サーバーは HMR のために
CSS を inline `<style>` として注入する (`updateStyle`)。これは Vite の設計そのもので
回避手段がなく、`style-src 'self'` とは原理的に両立しない。

```
Applying inline style violates the following Content Security Policy directive 'style-src 'self''.
updateStyle @ client:1070
```

CSS が丸ごとブロックされ、dev で見た目の確認ができなくなる。スタイル崩れを実装のバグと
誤認する事故も誘発する。

## 検討した選択肢

- **案 A: `'unsafe-inline'` を追加する** — 一行で全部直る。
  - Pros: 実装の自由度が最大。React の `style` prop がそのまま使える。
  - Cons: XSS 緩和という CSP の主目的を捨てる。外部由来の Markdown をレンダリングする以上、
    inline 実行を許すリスクは実在する。
- **案 B: 全環境で CSP を強制し、inline に依存しない書き方に寄せる**
  - Pros: 本番と同じ制約下で開発でき、CSP 違反が dev で露見する。
  - Cons: Vite の HMR と両立せず、dev で CSS が落ちたままになる。
- **案 C: development のみ `Content-Security-Policy-Report-Only` にする**
  - Pros: CSS は落ちず、違反はコンソールに出る。
  - Cons: HMR 由来の違反が常時報告され、ノイズの中から本物の違反を拾うことになる。
- **案 D: 本番系は厳格な CSP のまま、development だけ CSP を付けない (採用)**
  - Pros: 本番の防御は一切緩まない。dev の見た目が正しく確認できる。CSP を持つ構成としては
    最も一般的 (Vite / Next.js の dev サーバーも CSP を付けない)。
  - Cons: CSP 違反が dev で露見しない。

## 決定

案 D を採用する。

### 本番系の CSP は厳格に保つ

`'unsafe-inline'` は足さない。`app/backend/index.ts` の `secureHeaders` が
`default-src 'self'` / `script-src 'nonce-…' 'self'` / `style-src 'self'` /
`img-src 'self' data:` / `frame-ancestors 'none'` などを出す。埋め込み動画のホストだけは
`frame-src` に列挙してあり、描画側 (`mdast-renderer` / `embed.ts`) が src を同じホストへ
正規化しているので両者は対で動く。そのうえで、

- 見た目の可変軸は**静的な CSS のクラスの段階**として持つ
  (例: タグクラウドの大小は 6 段階のクラス、季節色は段階のクラス)。
- コンポーネント CSS は `app.css` に `@import` で束ねる。`import "./x.css"` を JS から
  行うと `<style>` 注入になり `style-src` にブロックされるため。`app.css` は `<link>` で届く。
- 自前で出す inline `<script>` には `c.get("secureHeadersNonce")` の nonce を付ける。
- `app/frontend/**/*.tsx` では ESLint (`react/forbid-dom-props`) で `style` 属性を禁止する。
- **連続値が要るときは Web Animations API か SVG の presentation attribute を使う。**
  段階で表せない軸に出会ったら、まずこの 2 つを検討する
  ([0008](0008-interactive-day-clock-via-web-animations-api.md))。

### CSP を付ける範囲

`APP_ENV === "development"` のときだけ CSP ヘッダーを付けない。それ以外
(staging / production、および想定外の値) では必ず付ける (secure by default)。
CSP 以外のセキュリティヘッダー (HSTS / X-Frame-Options / Referrer-Policy /
Permissions-Policy) は全環境で共通に付ける。

### dev で露見しない穴をどう埋めるか

- ESLint (`react/forbid-dom-props`) が `style` 属性を機械的に弾く。
- **CSP に関わる変更 (inline style / inline script / 外部リソースの追加) をしたら、
  `pnpm run preview:staging` で必ず確認する。** `pnpm run preview` では確認できない
  (`CLOUDFLARE_ENV` を指定しないビルドなので `APP_ENV=development` になり CSP が付かない)。
  Storybook にも CSP は無いので確認には使えない。
- 確認の目安は、CSP ヘッダーの `nonce-...` と HTML の `<script nonce="...">` が
  同一リクエスト内で一致していること。

## 帰結 / Consequences

- 良い面: 本番の XSS 緩和が保たれたまま、dev で見た目が正しく確認できる。
  lint が入ったので inline style の新規混入はコミット前に落ちる。
- 悪い面・トレードオフ:
  - CSP 違反が dev で露見しない。preview:staging まで見つからない。
  - 連続値が使えない場面がある。タグクラウドは 6 段階に離散化した。
  - コンポーネント CSS の co-location が弱まる。`x.tsx` の隣に `x.css` は置くが、
    読み込みは `app.css` 経由になる。
  - サードパーティのコンポーネントが nonce を受け取れない場合、自前で書き直す必要がある。
- 検証方法 / 今後の宣言: `app/backend/csp.test.ts` が「development では付かない」
  「staging / production および未知の APP_ENV では付く」「他のヘッダーは全環境で付く」を
  検証する。CSP を環境で分岐させる実装を変えたら、このテストを必ず通すこと。

### dev だけで出るコンソールエラー

`A tree hydrated but some attributes ... didn't match` — React Router の dev 専用
critical CSS (`data-react-router-critical-css`) が `nonce=""` の `<link>` を出す一方、
クライアント側の context には nonce が入らないため。本番の HTML にはこの `<link>` 自体が
存在しないので発生しない。**本番ビルドで再現しなければ追わなくてよい。**

## 参考 / More Information

- [#78](https://github.com/yantene/yantene.net/issues/78) / [#79](https://github.com/yantene/yantene.net/pull/79) — Celestim
- [#80](https://github.com/yantene/yantene.net/issues/80) — タグクラウド・dev hydration
- [CSP: style-src — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/style-src)
- 実装: `app/backend/index.ts` / テスト: `app/backend/csp.test.ts`
