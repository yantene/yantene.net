# 研究 & 設計判断

---

**目的**: 技術設計の判断根拠となるディスカバリー結果、アーキテクチャ調査、設計トレードオフを記録する。

---

## サマリー

- **機能**: `d1-drizzle-counter-demo`
- **ディスカバリー範囲**: 拡張機能（既存システムへのD1 + Drizzle統合）
- **主要な発見事項**:
  - Drizzle ORM 0.45.1 および Drizzle Kit 0.31.8 が Cloudflare D1 を完全サポート（プロダクション対応）
  - 参照実装（yantene.net 旧コードベース）からシンプルな統合パターンを適用可能
  - D1 は SQL BEGIN/COMMIT 非対応のため、トランザクションには db.batch() を使用する必要がある

## 研究ログ

### Drizzle ORM と Cloudflare D1 の最新バージョン互換性

- **コンテキスト**: 2026年1月時点での最新バージョンと互換性を確認
- **参照ソース**:
  - [Drizzle ORM - Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1)
  - [npm: drizzle-orm](https://www.npmjs.com/package/drizzle-orm)
  - [npm: drizzle-kit](https://www.npmjs.com/package/drizzle-kit)
- **発見事項**:
  - **最新バージョン（2026年1月3日時点）**:
    - drizzle-orm: 0.45.1
    - drizzle-kit: 0.31.8
  - Drizzle ORM は Cloudflare D1 および Workers 環境を完全サポート（Production Ready）
  - D1 用の推奨ドライバ: `d1-http`（Drizzle Kit 設定）、ランタイムは `drizzle-orm/d1` からインポート
  - Wrangler 設定には `nodejs_compat` フラグが必須
- **設計への影響**:
  - package.json に drizzle-orm と drizzle-kit を追加（最新安定版を使用）
  - drizzle.config.ts に `driver: "d1-http"` を設定
  - wrangler.jsonc に `nodejs_compat` フラグを追加

### D1 の制限事項とベストプラクティス

- **コンテキスト**: D1 特有の制約を確認
- **参照ソース**:
  - [Drizzle ORM - Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1)
  - [Cloudflare D1 & Drizzle ORM: TypeScript Worker Tutorial](https://medium.com/full-stack-engineer/how-do-you-connect-drizzle-orm-to-a-cloudflare-d1-database-in-a-worker-1eff33177f73)
- **発見事項**:
  - **トランザクション**: D1 は SQL BEGIN/COMMIT をサポートしない → `db.batch()` を使用する必要がある
  - **クエリメソッド**: `.all()`（複数行）、`.get()`（単一行）、`.run()`（実行のみ）、`.values()`（値配列）
  - **マイグレーション管理**: Wrangler CLI（`wrangler d1 migrations apply`）を使用するのが推奨
  - **ローカル開発**: `platformProxy.persist: true` で SQLite ファイルを永続化可能
- **設計への影響**:
  - カウンターデモでは単純な INSERT + COUNT 操作のためトランザクションは不要
  - エラーハンドリングで D1 固有のエラー（接続エラー、クエリ失敗）をキャッチ
  - マイグレーション適用は wrangler CLI を使用（npm scripts に追加）

### 参照実装からの統合パターン

- **コンテキスト**: gap-analysis.md に記載された旧 yantene.net の実装パターンを検証
- **参照ソース**: `.kiro/specs/d1-drizzle-counter-demo/gap-analysis.md`
- **発見事項**:
  - **Drizzle 設定パターン**:
    ```typescript
    // drizzle.config.ts
    export default defineConfig({
      dialect: "sqlite",
      schema: "./app/backend/infra/d1/schema",
      out: "./migrations",
      driver: "d1-http",
    });
    ```
  - **Wrangler D1 バインディング**:
    ```jsonc
    {
      "d1_databases": [{
        "binding": "D1",
        "database_name": "yantene-development",
        "database_id": "00000000-0000-0000-0000-000000000000",
        "migrations_dir": "./migrations"
      }]
    }
    ```
  - **Hono での初期化パターン**:
    ```typescript
    const db = drizzle(c.env.D1);
    const result = await db.insert(table).values(data).returning().get();
    ```
  - **npm scripts パターン**:
    - `db:generate`: マイグレーション生成（Drizzle Kit）
    - `db:migrate`: マイグレーション適用（Wrangler CLI）
    - `db:reset`: テーブル削除 + マイグレーション再適用
- **設計への影響**:
  - 参照実装のパターンをそのまま適用可能
  - カウンターデモではクリーンアーキテクチャ（リポジトリパターン、ドメイン層分離）は省略
  - シンプルな構成: `app/lib/db/schema.ts`（スキーマ定義）、`app/backend/index.ts`（API 実装）

## アーキテクチャパターン評価

| オプション                                 | 説明                                                                 | 強み                                                   | リスク / 制限                                         | 備考                                                      |
| ------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------- |
| **Option A: Simplified Approach** (推奨)   | 参照実装のパターンを活用しつつ、クリーンアーキテクチャは省略         | シンプルで理解しやすい、カウンターデモに適した規模     | 将来的に複雑なデータベース操作を追加する場合は要リファクタリング | gap-analysis.md で推奨、ファイル数最小（5-7 個）          |
| **Option B: Clean Architecture Approach**  | 参照実装のクリーンアーキテクチャパターンをそのまま適用（フル実装）   | 将来的な拡張性が高い、テスト容易性が向上               | カウンターデモには過剰な抽象化、学習曲線が急           | ファイル数が多い（10+ 個）、参照実装との一貫性は高い      |

## 設計判断

### 判断: アーキテクチャパターンの選択

- **コンテキスト**: カウンターデモの規模と目的（D1 + Drizzle のリファレンス実装）に適したアーキテクチャパターンを決定
- **検討した代替案**:
  1. **Option A: Simplified Approach** — 参照実装のベストプラクティスを活用しつつ、リポジトリパターンやドメイン層分離を省略
  2. **Option B: Clean Architecture Approach** — 参照実装のクリーンアーキテクチャパターンをフル実装
- **選択したアプローチ**: **Option A: Simplified Approach**
- **根拠**:
  - カウンターデモは単一テーブル（clicks）の単純な CRUD 操作のみ
  - 参照実装のパターン（Drizzle 設定、Wrangler 設定、npm scripts）は活用するが、過剰な抽象化は避ける
  - ファイル数を最小化し、理解しやすいコードを優先
  - 将来的に複雑なデータベース操作を追加する場合は、Option A から Option B へリファクタリング可能
- **トレードオフ**:
  - **利点**: シンプル、理解しやすい、既存の Hono + React Router パターンに自然に統合
  - **欠点**: クリーンアーキテクチャの full implementation ではない、将来的なリファクタリングが必要になる可能性
- **フォローアップ**: 実装フェーズで複雑なデータベース操作が必要になった場合は、設計を見直す

### 判断: スキーマ定義の配置

- **コンテキスト**: Drizzle スキーマファイルの配置場所を決定
- **検討した代替案**:
  1. `app/backend/infra/d1/schema/` — 参照実装のパターン（クリーンアーキテクチャ）
  2. `app/lib/db/schema.ts` — シンプルな配置（フロントエンドとバックエンドで共有可能）
- **選択したアプローチ**: `app/lib/db/schema.ts`
- **根拠**:
  - カウンターデモは単一テーブルのみ → 単一ファイルで十分
  - `app/lib/` は既存のプロジェクト構造で共有ユーティリティの配置場所
  - フロントエンドとバックエンドの両方から型定義を参照可能
- **トレードオフ**:
  - **利点**: ファイル数が少ない、型定義の共有が容易
  - **欠点**: 将来的に複数テーブルを追加する場合は、ディレクトリ構造の見直しが必要
- **フォローアップ**: 実装フェーズで複数テーブルを追加する場合は、`app/lib/db/schema/` ディレクトリに分離

### 判断: マイグレーション管理ツール

- **コンテキスト**: マイグレーション生成と適用のワークフローを決定
- **検討した代替案**:
  1. Drizzle Kit のみ使用（`drizzle-kit generate` + `drizzle-kit push`）
  2. Drizzle Kit + Wrangler CLI（`drizzle-kit generate` + `wrangler d1 migrations apply`）
- **選択したアプローチ**: **Drizzle Kit + Wrangler CLI**
- **根拠**:
  - Wrangler CLI は Cloudflare D1 の公式ツールであり、ローカル開発とリモート環境の両方をサポート
  - Drizzle Kit は型安全なマイグレーション生成に優れているが、D1 への適用は Wrangler が推奨される
  - 参照実装も同じパターンを採用
- **トレードオフ**:
  - **利点**: Cloudflare の公式ワークフローに準拠、ローカルとリモートの一貫性
  - **欠点**: 2 つのツールを併用する複雑さ
- **フォローアップ**: npm scripts でワークフローを自動化（`db:generate`, `db:migrate`, `db:reset`）

### 判断: npm Scripts の範囲

- **コンテキスト**: データベース関連の npm scripts をどこまで実装するか決定
- **検討した代替案**:
  1. 最小限（`db:generate`, `db:migrate`）
  2. 参照実装のフルセット（`db:dev:*`, `db:stg:*`, `db:drop`, `db:reset`, `db:execute`, `db:schema`）
- **選択したアプローチ**: **中間（`db:generate`, `db:migrate`, `db:reset`）**
- **根拠**:
  - カウンターデモでは環境分離（dev/stg）は不要（development のみ）
  - `db:reset` はローカル開発で便利（テーブル削除 + マイグレーション再適用）
  - `db:execute` や `db:schema` は手動で wrangler CLI を実行すれば十分
- **トレードオフ**:
  - **利点**: シンプルで理解しやすい、必要十分な機能
  - **欠点**: 参照実装のフルセットと比べると機能が制限される
- **フォローアップ**: 必要に応じて追加の npm scripts を実装

## リスクと緩和策

- **リスク 1: D1 トランザクション制限** — D1 は SQL BEGIN/COMMIT 非対応
  - **緩和策**: カウンターデモでは単純な INSERT + COUNT 操作のためトランザクションは不要。将来的に複雑な操作が必要になった場合は `db.batch()` を使用
- **リスク 2: マイグレーション管理の失敗** — マイグレーション適用に失敗した場合のロールバック手順が不明確
  - **緩和策**: `db:reset` スクリプトで全テーブル削除 + マイグレーション再適用を可能にする。ローカル環境で十分にテスト
- **リスク 3: 型定義の不整合** — Drizzle スキーマとフロントエンド/バックエンドの型定義が不一致になる可能性
  - **緩和策**: Drizzle ORM の型生成を活用（`InferSelectModel`, `InferInsertModel`）。TypeScript strict mode と ESLint の厳格ルールで検証
- **リスク 4: Wrangler 設定ミス** — D1 バインディング設定が誤っていると Workers がデータベースにアクセスできない
  - **緩和策**: 参照実装の wrangler.jsonc をほぼそのまま適用。Wrangler の公式ガイドに従う

## 参照資料

- [Drizzle ORM - Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1) — 公式ドキュメント、セットアップガイド
- [Drizzle ORM - Cloudflare D1 HTTP API with Drizzle Kit](https://orm.drizzle.team/docs/guides/d1-http-with-drizzle-kit) — Drizzle Kit 設定ガイド
- [Drizzle ORM Releases](https://github.com/drizzle-team/drizzle-orm/releases) — 最新バージョン情報
- [npm: drizzle-orm](https://www.npmjs.com/package/drizzle-orm) — パッケージ情報
- [npm: drizzle-kit](https://www.npmjs.com/package/drizzle-kit) — パッケージ情報
- [Cloudflare D1 & Drizzle ORM: TypeScript Worker Tutorial](https://medium.com/full-stack-engineer/how-do-you-connect-drizzle-orm-to-a-cloudflare-d1-database-in-a-worker-1eff33177f73) — ベストプラクティス
