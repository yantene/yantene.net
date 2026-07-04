# 0003. Clean Architecture (DIP) と CQRS を採用する

- Status: Accepted
- Date: 2026-07-05
- Deciders: @yantene

## Context / 背景

エッジランタイム (Cloudflare Workers) 上に Hono + Inertia.js でフルスタックアプリケーションを
構築するにあたり、ビジネスロジックとインフラ技術の結合度が問題になる。D1 (SQLite)・R2・KV など
Cloudflare 固有のバインディングにドメインロジックが直接依存すると、テスト困難・技術ロックインが生じる。

また、読み取りと書き込みでは要件が異なる場合が多い (一覧はページネーション付き・詳細は
単一取得・書き込みはバリデーション + 永続化)。単一のリポジトリに両方を持たせると
インターフェースが肥大化し、単一責任に反する。

## 検討した選択肢

- **案 A: レイヤー分離なし (フラット構成)** — ハンドラ内で直接 D1 クエリを書く。
  - Pros: 初期コストが低い。ファイル数が少ない。
  - Cons: ビジネスロジックとインフラが密結合。テストで D1 バインディングが必須。
    技術移行 (例: R2 → S3) 時に全箇所修正。
- **案 B: Clean Architecture (DIP) + CQRS** — domain / infra / services / handlers の
  レイヤー分離。リポジトリは Command / Query に分割。
  - Pros: ドメインがインフラ非依存。テスタブル。技術差し替えが infra 層で完結。
    読み取り/書き込みの責務が明確。
  - Cons: 初期のボイラープレートコードが増える。小規模アプリには重厚に感じる。

## 決定

案 B を採用する。

- domain/ はインフラ技術に依存しない。インターフェースを定義し、infra/ が実装する。
- リポジトリは Command (書き込み) と Query (読み取り) に分割する。
- 具象クラスの生成・注入は Composition Root (handlers/) のみが行う。
- レイヤー間の依存方向は `domain ← services ← handlers / middleware, infra → domain` とする。

## 帰結 / Consequences

- 良い面: ドメインロジックが純粋になり、テスト容易性が飛躍的に向上する。
  技術移行 (例: D1 → 別 DB、R2 → S3) が infra 層の差し替えで完結する。
- 悪い面: interface 定義、infra 実装、DI 配線のボイラープレートが増える。
  小さな機能追加でも複数レイヤーにまたがるファイル変更が発生する。
- 検証方法: 新規コードで domain/ が infra/ や handlers/ を import していないことを
  レビュー観点とする。CQRS 分割されていないリポジトリの追加は原則禁止する。

## 参考 / More Information

- Robert C. Martin, "Clean Architecture"
- Greg Young, "CQRS Documents"
- [0001](0001-record-architecture-decisions.md)
