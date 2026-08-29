# 0027. lint を Oxlint に移し、inline style の禁止は規約に留める

- Status: Accepted
- Date: 2026-08-29
- Deciders: @yantene

## Context / 背景

ツールチェインを Vite+ に寄せた。dev / build / preview / test / format は移したが、lint は
ESLint のまま残していた。Oxlint に移すと、**ESLint にあって Oxlint に無いルールが落ちる**
からで、その筆頭が `react/forbid-dom-props` (inline style の禁止) だった。

このルールは惰性で残っていたものではない。[ADR 0007](0007-strict-csp-outside-development.md) で
`style-src` に `'unsafe-inline'` を置いたとき、案 C の Cons にこう書いた。

> ADR 0007 が支えていた「見た目の可変軸は静的なクラスの段階で持つ」規律の強制力が弱まる。

CSP が担えなくなった規律を、ESLint に肩代わりさせたのがこのルールだった。

一方で、ルールが出すメッセージは事実と食い違っていた。

```
CSP (style-src 'self') が inline style 属性を落とすため本番で効かない
```

実際の CSP は `styleSrc: ["'self'", "'unsafe-inline'", ...]` で、**inline style は本番で
普通に効く**。「本番で効かない」は ADR 0007 の時点で嘘になっていた。

## 検討した選択肢

- **案 A: ESLint を据え置く**
  - Pros: 何も失わない。
  - Cons: 整形・テスト・ビルドが Vite+ に載っているのに lint だけ別系統で残る。
    ESLint とプラグイン 16 個を抱え続ける。
- **案 B: Oxlint を本体にし、ESLint を `forbid-dom-props` 専用に痩せさせて併用**
  - Pros: 歯止めを失わない。
  - Cons: **1 ルールのために ESLint とプラグイン一式を維持する。** CI のジョブも 2 つ要る。
    払う額に対して守るものが釣り合わない。
- **案 C: Oxlint に全面移行し、inline style の禁止は規約に留める (採用)**
  - Pros: lint も Vite+ に載る。ESLint と 16 個のプラグインが消える。型を見るルールは
    `--type-aware` でほぼ引き継げる。
  - Cons: inline style を機械が止めなくなる。

## 決定

案 C を採用する。

### 引き継げたもの

バグを捕まえる型ありルールは Oxlint でも動く。違反コードを書いて確かめた。

| ルール                          | Oxlint |
| ------------------------------- | ------ |
| `no-floating-promises`          | ○      |
| `no-misused-promises`           | ○      |
| `strict-boolean-expressions`    | ○      |
| `explicit-function-return-type` | ○      |
| `react-hooks/rules-of-hooks`    | ○      |

### 落としたもの

| ルール                                 | 何を失うか                               | 判断                                                                                                                                       |
| -------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `react/forbid-dom-props`               | inline style の禁止                      | 下記                                                                                                                                       |
| `no-secrets/no-secrets`                | 秘密の直書き検出                         | GitHub の secret scanning と push protection が有効で、そちらが本体。秘密は Cloudflare Secrets / GitHub Secrets にあり、コードには入らない |
| `@typescript-eslint/naming-convention` | boolean は `is`/`has` 始まり等の命名規約 | 破っても動かない。レビューで見える                                                                                                         |
| `import-x/order`                       | import の並び順                          | Oxfmt は import を並べ替えないので徐々に乱れる。差分が汚れるだけ                                                                           |

### inline style の禁止は規約に留める

**機械的な強制は無くなる。** CSP も止めず (ADR 0007)、lint も止めない。
それでも「見た目の可変軸は静的な CSS のクラスの段階として持つ」方針は変えない。

守られなかったときに起きるのは本番の破綻ではなく、設計の緩みである。連続値を `style` に
流す書き方が戻ると、クラスの段階で持つという設計が形骸化する。**そのことを承知のうえで、
1 ルールのために ESLint 一式を維持する額とは釣り合わないと判断した。**

`.claude/rules/architecture.md` の「強制は ESLint が担う」は「規約のみ」に書き換える。
**手順書が守られているふりをしないことが、この決定の条件である。**

## 帰結

### Oxlint の設定は `vite.config.ts` に置く

Vite+ は `vite.config.ts` の `lint` ブロックだけを読む。`.oxlintrc.json` を別に置いても
無視される (静かに無視されるので、置いた側は効いているつもりになる)。

`defineConfig` の引数に直接書かず `export default { ...viteConfig, lint: LINT_CONFIG }` の形に
してあるのは、vite-plus が vite のフォーク (`@voidzero-dev/vite-plus-core`) を使っており、
本家 vite の型で書いたプラグイン配列と突き合わせると tsc が
"Excessive stack depth comparing types" で落ちるため。

### ⚠️ 知らないルール名の扱いが経路で違う

| 経路                                      | 未知のルール名       |
| ----------------------------------------- | -------------------- |
| 設定ファイル (`vite.config.ts` の `lint`) | **エラーになる**     |
| CLI の `-D` / `-A`                        | **黙って無視される** |

CLI で確かめると「設定したつもりで何も効いていない」状態を作れる。**ルールを足したら、
違反コードを書いて実際に発火することを確かめること。**

### `options.typeCheck` は入れない

型を見るルールに要るのは `typeAware` だけ。`typeCheck` (TS の診断まで Oxlint に出させる
実験的な機能) は `pnpm run typecheck` の `tsc -b` と重複する。

### カテゴリ単位の有効化はしない

`-D all` や `pedantic` を入れると、`import/no-named-export`・`react/react-in-jsx-scope`・
`.tsx` を拒む `jsx-filename-extension` など、本プロジェクトの方針と正面からぶつかるものが
出る。`correctness` / `suspicious` / `perf` を error にし、残りは個別に足す。
