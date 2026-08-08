# 0009. CSP を厳格に保ち、見た目は inline ではなく静的な CSS で表現する

- Status: Superseded by [0011](0011-csp-enforced-outside-development.md)
- Date: 2026-07-28
- Deciders: @yantene

## Context / 背景

`app/backend/index.ts` の `secureHeaders` は `style-src 'self'` /
`script-src 'nonce-…' 'self'` を出しており、`'unsafe-inline'` を含まない。
このとき **ブラウザは inline `style` 属性を丸ごと無視する**。nonce は要素
(`<style>` / `<script>`) にしか付けられず、属性には効かないため、
`style={...}` で渡した値は本番で必ず消える。

これを知らずに書いたコードが繰り返し壊れた。

- Celestim (トップページの天体アニメ) が CSS 変数を `style` 属性で渡していたため、
  初回コミットから一度も描画されていなかった ([#78](https://github.com/yantene/yantene.net/issues/78))
- タグクラウドの文字サイズ強弱が同じ理由で効いていなかった ([#80](https://github.com/yantene/yantene.net/issues/80))
- dev の react-refresh プリアンブルが nonce 無しの inline `<script>` だったため、
  `pnpm dev` で hydration が起きなかった (同 #80)

いずれも**単体テストでは検知できず、CSP ヘッダが付いた実環境でしか露見しない**。
しかも「静かに壊れる」— 例外も警告も出ず、ただ見た目が消える。

## 検討した選択肢

- **案 A: `'unsafe-inline'` を追加する** — 一行で全部直る。
  - Pros: 実装の自由度が最大。React の `style` prop がそのまま使える。
  - Cons: XSS 緩和という CSP の主目的を捨てる。ノート本文は外部 (Artifacts) 由来の
    Markdown をレンダリングするため、inline 実行を許すリスクは実在する。
- **案 B: 開発環境だけ CSP を緩める** — 本番は厳格のまま。
  - Pros: DX が戻る。
  - Cons: dev と本番で挙動が変わる。上記 3 件はいずれも「dev では動くのに本番で消える」
    型の事故であり、まさにこの差分が原因で長期間気づけなかった。差を広げる方向は逆行。
- **案 C: CSP は据え置き、inline に依存しない書き方に寄せる** — 可変にしたい軸は
  クラスの段階として CSS 側に用意し、要素として出す inline `<script>` には nonce を付ける。
  - Pros: 本番と同じ制約下で開発できる。lint で機械的に守れる。
  - Cons: 連続値 (任意の rem 値など) が使えず、段階に離散化する必要がある。

## 決定

**案 C を採用する。** CSP に `'unsafe-inline'` を足さない。dev でも緩めない。

- 見た目の可変軸は**静的な CSS のクラス**として持つ
  (例: タグクラウドの大小は 6 段階のクラス、Celestim の速度は `celestim-sky-fast` 等)。
- コンポーネント CSS は `app.css` に `@import` で束ねる。dev の Vite は
  `import "./x.css"` を JS からの `<style>` 注入で届けるが、それも `style-src` に
  ブロックされるため。`app.css` は `<link>` で届くので影響を受けない。
- 自前で出す inline `<script>` には `c.get("secureHeadersNonce")` の nonce を付ける。
- `app/frontend/**/*.tsx` では ESLint (`react/forbid-dom-props`) で `style` を禁止する。

## 帰結 / Consequences

- 良い面: 本番と同じ制約で開発するので、この型の事故が dev で再現する。
  lint が入ったので新規混入はコミット前に落ちる。
- 悪い面・トレードオフ:
  - 連続値が使えない。タグクラウドは 6 段階に離散化した (視覚的には十分だが、
    件数の差をピクセル単位で反映することはできない)。
  - コンポーネント CSS の co-location が弱まる。`x.tsx` の隣に `x.css` は置くが、
    読み込みは `app.css` 経由になり、宣言と読み込みが 1 ファイルに閉じない。
  - サードパーティのコンポーネントが nonce を受け取れない場合、自前で書き直す必要がある
    (`vite-ssr-components` の `<ReactRefresh />` は実際にそうした)。
- 検証方法 / 今後の宣言:
  - ESLint の `react/forbid-dom-props` が `style` を機械的に弾く。
  - 見た目に関わる変更は `pnpm dev` (CSP 有効) か `vite preview` で確認する。
    Storybook には CSP が無いため、Storybook だけの確認では検知できない。

## 参考 / More Information

- [#78](https://github.com/yantene/yantene.net/issues/78) / [#79](https://github.com/yantene/yantene.net/pull/79) — Celestim
- [#80](https://github.com/yantene/yantene.net/issues/80) — タグクラウド・dev hydration
- [CSP: style-src — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/style-src)
