# Research & Design Decisions

---

**Purpose**: 記事再構築 API の設計判断を裏付ける調査結果と設計決定の記録。

---

## Summary

- **Feature**: `notes-refresh-api`
- **Discovery Scope**: Extension (既存 SyncService パターンの拡張)
- **Key Findings**:
  - 既存の SyncService (stored-object 用) の突合パターンを Note ドメインに適用可能
  - YAML frontmatter パースには unified/remark エコシステム (remark-parse + remark-frontmatter + vfile-matter) を採用 (将来の Markdown AST 活用に対応)
  - Notes 用の R2 バケットバインディング (`NOTES_R2`) の追加が必要
  - 既存の Note エンティティ、リポジトリは upsert/deleteBySlug の追加が必要

## Research Log

### 既存 SyncService パターンの分析

- **Context**: 要件で「既存の SyncService (stored-object 用) と同様のパターンで実装する」と指定
- **Sources Consulted**: `app/backend/services/sync.service.ts`, `app/backend/handlers/api/admin/files/index.ts`
- **Findings**:
  - SyncService は Storage (R2) + QueryRepository + CommandRepository の 3 依存で構成
  - `execute()` メソッドで storage.list() と queryRepository.findAll() を並列取得
  - Map ベースの突合で追加・更新・削除を判定 (etag 比較)
  - SyncResult (`{ added, deleted, updated }`) を返却
  - Handler 層で DI (drizzle, R2 バインディングからインスタンス生成)
- **Implications**: Note 用の NotesRefreshService も同パターンで設計可能。ただし Note は R2 からメタデータ取得 (frontmatter パース) が追加で必要

### YAML Frontmatter パースライブラリの調査

- **Context**: R2 の Markdown ファイルから YAML frontmatter をパースする必要がある。将来的に Markdown 本文の AST 操作も予定
- **Sources Consulted**: npm (unified, remark-parse, remark-frontmatter, vfile-matter, gray-matter), Cloudflare Workers ドキュメント
- **Findings**:
  - `unified + remark-parse + remark-frontmatter + vfile-matter`: Markdown AST (mdast) がファーストクラス。150+ プラグインで拡張可能。TypeScript 完全対応
  - `remark-frontmatter`: frontmatter 構文を mdast ノードとして認識。vfile-matter と組み合わせて YAML データを `file.data.matter` に抽出
  - `gray-matter`: 最も広く使われる frontmatter パーサーだが、AST 機能なし。将来の Markdown AST 活用に対応できない
  - `front-matter`: 軽量な代替。YAML のみ対応。AST 機能なし
- **Implications**: unified/remark エコシステムを採用。今回は frontmatter パースのみだが、将来の Markdown 本文 AST 操作にそのまま拡張可能

### R2 バケット構成の調査

- **Context**: Notes 用の R2 ストレージアクセスが必要
- **Sources Consulted**: `wrangler.jsonc`, `worker-configuration.d.ts`
- **Findings**:
  - 現在の R2 バインディングは `R2` (stored-object 用)
  - Notes 用の R2 バケットバインディングは未設定
  - `wrangler.jsonc` に新しい R2 バケットバインディング (`NOTES_R2`) の追加が必要
  - `wrangler types` で `worker-configuration.d.ts` を再生成する必要あり
- **Implications**: wrangler.jsonc への設定追加と型再生成がインフラ前提タスクとして必要

### Note ドメインモデルの既存状態分析

- **Context**: 既存の Note エンティティとリポジトリの拡張可否を判定
- **Sources Consulted**: `app/backend/domain/note/`, `app/backend/infra/d1/note/`
- **Findings**:
  - Note エンティティ: title, slug, etag, imageUrl, publishedOn, lastModifiedOn を保持 (要件と一致)
  - INoteCommandRepository: `save(note)` と `delete(id)` のみ。upsert や slug ベース削除なし
  - INoteQueryRepository: `findAll()` と `findBySlug(slug)` あり (突合に十分)
  - NoteCommandRepository (D1 実装): save は INSERT のみ。UPDATE 非対応
  - NoteSlug VO: `^[a-z0-9]+(?:-[a-z0-9]+)*$` のバリデーション済み
- **Implications**:
  - INoteCommandRepository に `upsert` メソッドの追加が必要 (既存 save を拡張)
  - `deleteBySlug(slug)` メソッドの追加が必要 (突合処理で slug ベース削除が自然)
  - Note エンティティ自体は変更不要

## Architecture Pattern Evaluation

| Option                   | Description                                                       | Strengths                                  | Risks / Limitations                                                   | Notes                             |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- | --------------------------------- |
| SyncService 拡張パターン | 既存 SyncService と同構造で NotesRefreshService を新規作成        | 一貫したパターン、既存テストを参考にできる | R2 からの本文取得が追加フェーズとなり I/O 増                          | 採用: steering の既存パターン準拠 |
| 汎用 SyncService 抽象化  | SyncService をジェネリクスで抽象化し Note/StoredObject 両方を統一 | コード重複削減                             | 抽象化コストが高く、ドメイン固有ロジック (frontmatter) の差異が大きい | 不採用: 過剰抽象化                |

## Design Decisions

### Decision: NotesRefreshService を独立サービスとして新規作成

- **Context**: 既存 SyncService パターンを Note ドメインに適用する方法の選択
- **Alternatives Considered**:
  1. 既存 SyncService をジェネリクスで汎用化
  2. Note 専用の NotesRefreshService を新規作成
- **Selected Approach**: Note 専用の NotesRefreshService を新規作成
- **Rationale**: Note の同期処理は frontmatter パースという固有のステップがあり、StoredObject の同期とは本質的に異なる。無理に抽象化すると複雑度が上がる
- **Trade-offs**: 一部コード重複 (突合ロジック) が発生するが、ドメイン固有ロジックの明確さを優先
- **Follow-up**: 将来的に共通の突合ユーティリティ関数の抽出を検討

### Decision: frontmatter パースはドメイン層の関数として直接実装

- **Context**: R2 から取得した Markdown テキストから Note エンティティを生成する処理の配置
- **Alternatives Considered**:
  1. インフラ層 (R2 Storage) 内でパース
  2. ドメイン層にパースインタフェースを定義し、インフラ層で実装 (DIP)
  3. ドメイン層に `parseNoteContent` 関数を配置し、unified/remark を直接使用
- **Selected Approach**: ドメイン層に `parseNoteContent` 関数を配置し、unified/remark を直接使用
- **Rationale**: unified/remark は純粋データ変換ライブラリ (I/O なし、副作用なし) であり、`Temporal` と同じカテゴリのユーティリティ。DIP でインフラから隔離すべきなのは I/O を伴う技術 (R2, D1 等) であり、remark はこれに該当しない。インタフェースを挟むと不要な抽象層が増え、将来の AST 拡張時にもインタフェース変更が必要になる
- **Trade-offs**: ドメイン層が remark に直接依存するが、remark は純粋関数的であり実質的なリスクなし
- **Follow-up**: なし

### Decision: R2 バケットバインディングの分離

- **Context**: Notes の Markdown ファイルを格納する R2 バケットの扱い
- **Alternatives Considered**:
  1. 既存の `R2` バインディングを共用 (プレフィックスで分離)
  2. `NOTES_R2` として別バケットバインディングを追加
- **Selected Approach**: `NOTES_R2` として別バケットバインディングを追加
- **Rationale**: 要件が「R2 バケット (notes)」と明示的に分離を示唆。バケット分離によりアクセス制御・運用が容易
- **Trade-offs**: wrangler.jsonc の設定追加と型再生成が必要
- **Follow-up**: wrangler.jsonc への設定追加、`wrangler types` の再実行

### Decision: INoteCommandRepository に upsert メソッドを追加

- **Context**: 追加・更新処理で既存の save (INSERT のみ) では不足
- **Alternatives Considered**:
  1. save を UPDATE 対応に変更
  2. upsert メソッドを新規追加
  3. update メソッドを別途追加
- **Selected Approach**: `upsert` メソッドを新規追加、`deleteBySlug` メソッドも追加
- **Rationale**: stored-object の CommandRepository と一貫したパターン。突合処理では slug ベースの操作が自然
- **Trade-offs**: インタフェース変更により既存テストの更新が必要
- **Follow-up**: 既存の NoteCommandRepository テストの更新

## Risks & Mitigations

- **unified/remark の Cloudflare Workers 互換性**: unified エコシステムは純粋な JavaScript/ESM で構成されており、Node.js 固有 API への依存が少ないため低リスク
- **R2 list() のページネーション**: R2 の list() はデフォルトで最大 1000 オブジェクト。記事数が 1000 を超える場合はページネーション対応が必要。現時点では低リスク (記事数は十分に少ない見込み)
- **frontmatter パースエラーのハンドリング**: 不正な frontmatter のファイルが存在する場合、同期全体が失敗する。ファイル単位のエラー情報をレスポンスに含める設計で対応

## References

- [unified (npm)](https://www.npmjs.com/package/unified) -- AST パイプラインエンジン
- [remark-parse (npm)](https://www.npmjs.com/package/remark-parse) -- Markdown → mdast パーサー
- [remark-frontmatter (npm)](https://www.npmjs.com/package/remark-frontmatter) -- YAML frontmatter 構文認識プラグイン
- [vfile-matter (npm)](https://www.npmjs.com/package/vfile-matter) -- YAML frontmatter データ抽出ユーティリティ
- [Cloudflare R2 API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) -- R2 Workers API リファレンス
- [Cloudflare D1](https://developers.cloudflare.com/d1/) -- D1 ドキュメント
