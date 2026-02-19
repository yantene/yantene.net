# Research & Design Decisions

---

**Purpose**: Note ドメインモデル設計に関する調査結果と設計判断の根拠を記録する。

---

## Summary

- **Feature**: `note-domain-model`
- **Discovery Scope**: Extension（既存システムの拡張）
- **Key Findings**:
  - 既存の StoredObjectMetadata エンティティパターンが Note エンティティの設計に直接適用可能
  - ETag 値オブジェクトは `app/backend/domain/stored-object/etag.vo.ts` から再利用可能
  - D1 スキーマ定義・CQRS リポジトリ実装ともに既存パターンに完全に準拠できる

## Research Log

### 既存ドメインモデルパターンの分析

- **Context**: Note エンティティの設計にあたり、既存のエンティティ・値オブジェクト・リポジトリパターンを調査した
- **Sources Consulted**:
  - `app/backend/domain/entity.interface.ts` — IEntity インターフェース
  - `app/backend/domain/persisted.interface.ts` — IPersisted インターフェース
  - `app/backend/domain/unpersisted.interface.ts` — IUnpersisted インターフェース
  - `app/backend/domain/value-object.interface.ts` — IValueObject インターフェース
  - `app/backend/domain/stored-object/stored-object-metadata.entity.ts` — エンティティ実装例
  - `app/backend/domain/stored-object/etag.vo.ts` — ETag 値オブジェクト
  - `app/backend/domain/stored-object/object-key.vo.ts` — ObjectKey 値オブジェクト
- **Findings**:
  - エンティティは `IEntity<T>` を実装し、private コンストラクタ + `create` / `reconstruct` ファクトリメソッドパターンを採用
  - ジェネリクス `P extends IPersisted | IUnpersisted` により永続化状態をコンパイル時に区別
  - 値オブジェクトは `IValueObject<T>` を実装し、private コンストラクタ + `create` ファクトリメソッド + バリデーションの構造
  - `equals` メソッドは永続化済みの場合 id 比較、未永続化の場合参照一致
  - `toJSON` メソッドでシリアライズ対応
- **Implications**: Note エンティティおよび NoteTitle, NoteSlug, ImageUrl 値オブジェクトは、これらの既存パターンに完全に準拠して設計する

### D1 スキーマ定義パターンの分析

- **Context**: notes テーブルの Drizzle ORM スキーマ定義パターンを調査した
- **Sources Consulted**:
  - `app/backend/infra/d1/schema/object-storage-file-metadata.table.ts` — テーブル定義例
  - `app/backend/infra/d1/schema/clicks.table.ts` — テーブル定義例
  - `app/backend/infra/d1/schema/custom-types/temporal.custom-type.ts` — Temporal.Instant カスタム型
  - `app/backend/infra/d1/schema/index.ts` — スキーマエクスポート
- **Findings**:
  - `sqliteTable` を使用し、`text` / `integer` / カスタム型を組み合わせてカラム定義
  - `instant` カスタム型で `Temporal.Instant` を `real` 型（epoch秒）として保存
  - `createdAt` / `updatedAt` は `instant` 型でデフォルト値 `sql\`(unixepoch('subsec'))\`` を設定
  - スキーマは `index.ts` から re-export
- **Implications**: notes テーブルも同じパターンで定義し、slug カラムにユニーク制約を追加する

### CQRS リポジトリパターンの分析

- **Context**: Command / Query リポジトリの分離パターンを調査した
- **Sources Consulted**:
  - `app/backend/domain/stored-object/stored-object-metadata-command-repository.interface.ts`
  - `app/backend/domain/stored-object/stored-object-metadata-query-repository.interface.ts`
  - `app/backend/infra/d1/stored-object/stored-object-metadata.command-repository.ts`
  - `app/backend/infra/d1/stored-object/stored-object-metadata.query-repository.ts`
- **Findings**:
  - ドメイン層にインターフェース定義、インフラ層に具象実装
  - Command リポジトリは `DrizzleD1Database` をコンストラクタで受け取る
  - Query リポジトリは `toEntity` プライベートメソッドで DB 行をドメインエンティティに変換
  - Command リポジトリが Query リポジトリを依存として持つケースがある（upsert 後のフェッチ用）
- **Implications**: Note の CQRS リポジトリも同じ構造で設計する。ただし Note の save メソッドは insert のみ（upsert ではない）とし、Command リポジトリから Query リポジトリへの依存は save 後の結果取得に活用する

### ETag 値オブジェクトの再利用可能性

- **Context**: Note エンティティで既存の ETag 値オブジェクトを再利用できるか確認した
- **Sources Consulted**:
  - `app/backend/domain/stored-object/etag.vo.ts`
- **Findings**:
  - ETag は汎用的な値オブジェクトであり、stored-object ドメイン固有のロジックを含まない
  - バリデーションは空文字列チェックのみ
  - Note ドメインからのインポートパスは `~/backend/domain/stored-object/etag.vo` となる
- **Implications**: ETag は stored-object パッケージからそのまま再利用する。将来的に共有 VO パッケージへの移動を検討してもよいが、本フィーチャーのスコープ外とする

## Architecture Pattern Evaluation

| Option           | Description                                                              | Strengths                                                | Risks / Limitations            | Notes                                    |
| ---------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------ | ---------------------------------------- |
| 既存パターン準拠 | StoredObjectMetadata と同じ Entity + VO + CQRS Repository パターンを適用 | 一貫性が高い、学習コスト不要、既存テストパターン流用可能 | パターンの制約を受ける         | 推奨。既存コードベースとの整合性を最優先 |
| 独自パターン導入 | Note 固有の新しいパターンを設計                                          | Note に最適化可能                                        | チーム内不整合、保守コスト増大 | 不採用。メリットが少ない                 |

## Design Decisions

### Decision: ETag 値オブジェクトの再利用

- **Context**: Note エンティティは etag プロパティを持つ必要がある
- **Alternatives Considered**:
  1. 既存の `stored-object/etag.vo.ts` をインポートして再利用
  2. Note ドメイン内に NoteETag 値オブジェクトを新規作成
- **Selected Approach**: 既存の ETag 値オブジェクトを再利用する
- **Rationale**: ETag はドメイン横断的な概念であり、stored-object 固有のロジックを含まない。要件 5 でも明示的に再利用が求められている
- **Trade-offs**: Note ドメインが stored-object パッケージに依存する形になるが、ETag 自体は汎用的であるため問題ない
- **Follow-up**: 将来的に共有 VO パッケージ（`domain/shared/`）への移動を検討可能

### Decision: NoteSlug のバリデーションルール

- **Context**: NoteSlug の「URL に安全なスラッグ」の定義を決める必要がある
- **Alternatives Considered**:
  1. 英数字・ハイフン・アンダースコアのみ許可（`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`）
  2. URL エンコード可能な任意の文字列を許可
  3. 日本語を含む広範な文字列を許可しつつ、特定の禁止文字のみ除外
- **Selected Approach**: 英小文字・数字・ハイフンのみ許可する正規表現パターンを採用（`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`）
- **Rationale**: URL の可読性と安全性を最大化し、SEO に適した形式を担保する。先頭・末尾のハイフンや連続ハイフンを禁止する
- **Trade-offs**: 日本語スラッグは使用不可となるが、URL の一貫性と安全性を優先する
- **Follow-up**: 将来的に日本語対応が必要な場合はバリデーションルールの緩和を別途検討

### Decision: NoteCommandRepository の save メソッド設計

- **Context**: save メソッドの振る舞い（insert のみ vs upsert）を決定する必要がある
- **Alternatives Considered**:
  1. insert のみ（新規作成専用）
  2. upsert（StoredObjectMetadata と同様）
  3. save（insert or update を自動判定）
- **Selected Approach**: save メソッドとして設計し、IUnpersisted 状態の Note を受け取り IPersisted 状態を返す（要件 7.1 に準拠）
- **Rationale**: 要件 7.1 の仕様に忠実に従う。初期実装では insert 相当の動作となる
- **Trade-offs**: 更新操作は将来的に別途メソッド追加が必要となる可能性がある
- **Follow-up**: 更新要件が発生した場合、update メソッドの追加を検討

## Risks & Mitigations

- ETag を stored-object パッケージから参照することで、パッケージ間の依存が生まれる — 将来的に共有パッケージへの移動で解消可能
- NoteSlug のバリデーションルールが厳格すぎる可能性がある — バリデーションルールは値オブジェクト内に閉じているため、変更が容易
- D1 マイグレーションが別途必要 — 本フィーチャーではスキーマ定義のみスコープとし、マイグレーション実行は運用手順に委ねる

## References

- [Drizzle ORM - SQLite](https://orm.drizzle.team/docs/get-started-sqlite) — Drizzle ORM の SQLite 対応ドキュメント
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — Cloudflare D1 公式ドキュメント
- [TC39 Temporal Proposal](https://tc39.es/proposal-temporal/docs/) — Temporal API 仕様
