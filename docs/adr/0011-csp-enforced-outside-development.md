# 0011. CSP は development では付けず、staging / production でのみ強制する

- Status: Accepted
- Date: 2026-08-08
- Deciders: @yantene

## Context / 背景

[0009](0009-strict-csp-without-unsafe-inline.md) では「CSP に `'unsafe-inline'` を足さない。
dev でも緩めない」(案 C) を採用した。その判断は、**dev でも CSS が
`<link rel="stylesheet">` で配信されている**という前提の上に成り立っていた。当時は
Inertia + vite-ssr-components が `<link href="/app/frontend/app.css">` を出していたため、
`style-src 'self'` 下でも dev の見た目が壊れなかった。

[0010](0010-react-router-v7-over-inertia.md) で React Router v7 へ移行した結果、この前提が
崩れた。Vite の dev サーバーは HMR のために CSS を inline `<style>` として注入する
(`updateStyle`)。これは Vite の設計そのもので回避手段がなく、`style-src 'self'` とは
原理的に両立しない。

現象として、`pnpm dev` では次が起きる。

```
Applying inline style violates the following Content Security Policy directive 'style-src 'self''.
updateStyle @ client:1070
```

**CSS が丸ごとブロックされ、dev で見た目の確認ができない。** 0009 が
「見た目に関わる変更は `pnpm dev` (CSP 有効) か `vite preview` で確認する」と定めた
運用自体が成立しなくなった。

## 検討した選択肢

- **案 A: 0009 のまま dev でも CSP を強制する** — 現状維持。
  - Pros: 本番と同じ制約で開発できる (0009 の狙いを維持)。
  - Cons: dev で CSS が落ちたままになり、見た目の確認ができない。スタイル崩れを
    実装のバグと誤認する事故を誘発する (実際、移行作業中に誤認が起きた)。
- **案 B: development のみ CSP を外す (採用)** — staging / production は 0009 のまま厳格。
  - Pros: dev の見た目が戻る。CSP を持つ構成としては最も一般的 (Vite / Next.js の dev
    サーバーもCSP を付けない)。本番の防御は一切緩まない。
  - Cons: CSP 違反が dev で露見しなくなる。0009 が案 B として却下した論点そのもの。
- **案 C: development のみ `Content-Security-Policy-Report-Only` にする** — ブロックせず報告のみ。
  - Pros: CSS は落ちず、違反はコンソールに出るので dev でも気づける。
  - Cons: 常設運用としては一般的でない。Vite の HMR 由来の違反が常時報告され、
    ノイズの中から本物の違反を拾うことになる。

## 決定

**案 B を採用する。** `APP_ENV === "development"` のときだけ CSP ヘッダーを付けない。
それ以外 (staging / production、および想定外の値) では必ず付ける (secure by default)。
CSP 以外のセキュリティヘッダー (HSTS / X-Frame-Options / Referrer-Policy /
Permissions-Policy) は全環境で共通に付けたままとする。

0009 の「`'unsafe-inline'` を足さない」という決定自体は覆さない。**本番の CSP は 0009 の
ままである。** 変わるのは「dev でも強制するか」の一点で、その前提が 0010 の移行で
崩れたことによる決め直しである。

## 帰結 / Consequences

- 良い面: `pnpm dev` で見た目が正しく確認できるようになる。本番の CSP は無変更。
- 悪い面・トレードオフ: CSP 違反が dev で露見しなくなる。0009 が挙げた 3 件
  (Celestim の描画・タグクラウド・react-refresh) と同種の事故は、preview / staging まで
  見つからない。この穴を埋めるのは次の 2 つに委ねる。
  - ESLint (`react/forbid-dom-props`) が `app/frontend/**/*.tsx` の `style` 属性を弾く
  - **CSP に依存する変更 (inline style / inline script / 外部リソースの追加) を含むときは、
    `pnpm run preview` で必ず確認する**
- 検証方法 / 今後の宣言: `app/backend/csp.test.ts` が「development では付かない」
  「staging / production および未知の APP_ENV では付く」「他のヘッダーは全環境で付く」を
  検証する。CSP を環境で分岐させる実装を変えたら、このテストを必ず通すこと。

## 参考 / More Information

- [0009](0009-strict-csp-without-unsafe-inline.md) — 本 ADR により Superseded。
  本番の CSP 方針 (`'unsafe-inline'` を足さない) は 0009 の内容を引き継ぐ
- [0010](0010-react-router-v7-over-inertia.md) — 前提が崩れた原因となった移行
- 実装: `app/backend/index.ts` / テスト: `app/backend/csp.test.ts`
