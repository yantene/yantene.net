# Research & Design Decisions

---

## Summary

- **Feature**: `r2-download-demo`
- **Discovery Scope**: Extension（既存 DDD アーキテクチャの R2 ストレージ拡張）
- **Key Findings**:
  - Cloudflare R2 の `wrangler.jsonc` バインディング設定は `r2_buckets` 配列で定義し、`binding` と `bucket_name` を指定する
  - Hono RPC クライアント (`hc`) は `AppType` を型引数に渡すことで、ランタイムオーバーヘッドなしに型安全な API 呼び出しを実現する
  - 参考プロジェクトの DDD パターン（`IValueObject`, `IEntity`, Storage Interface, Repository Interface）が既存コードベースと互換性がある

## Research Log

### Cloudflare R2 バインディング設定

- **Context**: wrangler.jsonc に R2 バケットバインディングを追加する方法の確認
- **Sources Consulted**:
  - [Wrangler Configuration - Cloudflare Workers docs](https://developers.cloudflare.com/workers/wrangler/configuration/)
  - [Use R2 from Workers - Cloudflare R2 docs](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)
- **Findings**:
  - `r2_buckets` 配列に `binding`, `bucket_name` を指定する
  - `preview_bucket_name` で開発時の別バケットを指定可能
  - 環境別設定は `env.production.r2_buckets` で定義する
  - `wrangler types` を再実行すると `Cloudflare.Env` に `R2: R2Bucket` が自動追加される
  - Remote bindings（2025年9月 GA）により、ローカル開発から本番 R2 バケットへの接続も可能
- **Implications**: 既存の D1 バインディングパターンと同じ構造で R2 を追加できる。`wrangler types` による自動型生成が利用可能。

### R2 Workers API (R2Bucket, R2Object, R2ObjectBody)

- **Context**: R2 バケットからのオブジェクト取得 API の型と振る舞いの確認
- **Sources Consulted**:
  - [Workers API reference - Cloudflare R2 docs](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- **Findings**:
  - `R2Bucket.list(options?)`: `R2Objects` を返却。`objects` プロパティに `R2Object[]` を含む
  - `R2Bucket.get(key)`: `R2ObjectBody | null` を返却。`body` は `ReadableStream`
  - `R2Object` のプロパティ: `key`, `size`, `etag`, `httpEtag`, `httpMetadata.contentType`, `uploaded`
  - `R2ObjectBody` は `R2Object` を継承し、`body` (ReadableStream), `text()`, `arrayBuffer()`, `json()` を追加
  - 型の絞り込み: `get()` が `onlyIf` オプション付きの場合 `R2Object | R2ObjectBody` を返却する可能性がある（本機能では不使用）
- **Implications**: `R2Bucket.get(key)` の戻り値 null チェックで 404 ハンドリングが可能。`httpMetadata.contentType` からコンテンツタイプを取得できる。

### Hono RPC クライアント統合

- **Context**: Hono RPC クライアント (`hc`) の型安全な API 呼び出し方法の確認
- **Sources Consulted**:
  - [RPC - Hono docs](https://hono.dev/docs/guides/rpc)
  - [Hono Stacks](https://hono.dev/docs/concepts/stacks)
- **Findings**:
  - サーバーサイドで `export type AppType = typeof route` として型をエクスポートする
  - クライアントサイドで `hc<AppType>(baseUrl)` を呼び出して型安全なクライアントを生成する
  - `InferResponseType`, `InferRequestType` ユーティリティ型で個別エンドポイントの型を抽出可能
  - 実際のコードは生成されない（型のみのインポート）ため、ランタイムオーバーヘッドなし
  - モノレポ構成では TypeScript Project References の設定が必要な場合がある
- **Implications**: 既存の `getApp` 関数の戻り値型を `AppType` としてエクスポートすることで、フロントエンドから型安全に API を呼び出せる。

### 参考プロジェクト DDD パターン分析

- **Context**: `tmp/yantene.net.old` の R2 実装パターンとの整合性確認
- **Sources Consulted**: 参考プロジェクトのソースコード
- **Findings**:
  - `IValueObject<T>`: `equals(other)` + `toJSON()` インターフェース
  - `IEntity<T>`: `equals(other)` インターフェース、`IPersisted` / `IUnpersisted` ジェネリクス
  - `IEntryStorage`: `listAll()` + `get(slug)` メソッドのストレージインターフェース
  - `EntryStorage`: `R2Bucket` を DI で受け取る実装クラス
  - D1 スキーマ: Drizzle ORM カスタム型（`slug`, `etag`, `instant` 等）で値オブジェクトとの変換を定義
  - エンティティの entries テーブルに `etag` カラムを保持（キャッシュ検証用）
- **Implications**: 現在のプロジェクトの `IEntity`, `IPersisted`, `IUnpersisted` インターフェースと互換性がある。`IValueObject` インターフェースは参考プロジェクトから移植が必要。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
| --- | --- | --- | --- | --- |
| DDD レイヤード（採用） | 既存パターンの拡張（domain/infra/handlers） | コードベース一貫性、参考プロジェクト準拠 | 小規模デモには overengineering の可能性 | Steering 準拠、チーム学習効果 |
| シンプル Handler 直接実装 | Handler 内で直接 R2/D1 アクセス | 実装速度が速い | DDD パターン不一致、テスト困難 | 要件 5 で DDD が明示的に要求 |

## Design Decisions

### Decision: R2 ストレージインターフェースの分離（IR2FileStorage）

- **Context**: R2 アクセス層のインターフェース設計
- **Alternatives Considered**:
  1. 参考プロジェクトの `IEntryStorage` パターン準拠（`listAll` + `get`）
  2. R2 アクセスを Handler 内で直接実行
- **Selected Approach**: `IR2FileStorage` を `get` のみに限定し、一覧取得は D1 メタデータリポジトリに委譲する
- **Rationale**: 要件 6.4 で「ファイル一覧 API は D1 からメタデータを取得してレスポンスを構築する」と明記されているため、一覧取得は D1 側の責務とし、R2 ストレージは個別コンテンツ取得に特化する
- **Trade-offs**: R2 の `list()` を直接使用する場合より D1 との同期が必要になるが、メタデータクエリの高速化と ETag キャッシュ検証が可能になる
- **Follow-up**: D1 メタデータの初期投入スクリプトまたはマイグレーション時のシードデータが必要

### Decision: Hono RPC クライアントの導入

- **Context**: フロントエンドからバックエンド API を呼び出す方法
- **Alternatives Considered**:
  1. 素の `fetch` API（既存 Counter Demo パターン）
  2. Hono RPC クライアント `hc`
- **Selected Approach**: Hono RPC クライアント `hc` を使用する
- **Rationale**: 要件 7.1 - 7.3 で Hono RPC クライアントの使用が明示的に要求されている。型安全な API 呼び出しにより、フロントエンド・バックエンド間の型不整合を防止する
- **Trade-offs**: `hono/client` の追加インポートが必要だが、Hono は既存依存関係に含まれておりバンドルサイズの影響は最小限
- **Follow-up**: `AppType` のエクスポート方法が既存の `getApp` パターンと整合するか実装時に検証する

### Decision: ファイルコンテンツ取得パスのワイルドカード対応

- **Context**: R2 オブジェクトキーにネストされたパス（例: `images/photo.png`）を含む場合のルーティング
- **Alternatives Considered**:
  1. `:key` 単一パラメータ（スラッシュを含まない）
  2. ワイルドカードパス `files/*` でネストされたパスを許容
- **Selected Approach**: Hono のワイルドカードパスパラメータを使用する
- **Rationale**: R2 オブジェクトキーはフォルダ構造（例: `images/photo.png`, `docs/readme.md`）を含む可能性がある
- **Trade-offs**: パスパラメータの解析が若干複雑になるが、柔軟性が向上する
- **Follow-up**: Hono のワイルドカードパラメータの取得方法を実装時に確認する

### Decision: IValueObject インターフェースの新規作成

- **Context**: デザインレビューにより、`IValueObject<T>` インターフェースが現在のコードベースに存在しないことが判明した。参考プロジェクト（`tmp/yantene.net.old/app/backend/domain/value-object.interface.ts`）にのみ存在する
- **Alternatives Considered**:
  1. 値オブジェクトを `IValueObject` なしで実装する（インターフェースを省略）
  2. 参考プロジェクトから `IValueObject` を移植して `app/backend/domain/value-object.interface.ts` に新規作成する
- **Selected Approach**: 参考プロジェクトから移植して新規作成する
- **Rationale**: DDD パターンの一貫性を維持し、値オブジェクトの `equals` + `toJSON` 契約を型レベルで強制するため。関連する JSON ユーティリティ型（`JsonPrimitive`, `JsonValue`, `IJsonObject`, `IJsonArray`）も含める
- **Trade-offs**: 新規ファイル追加が必要だが、将来の値オブジェクト追加時に再利用可能
- **Follow-up**: なし（設計で確定）

### Decision: ファイルコンテンツ API の RPC 対象外化

- **Context**: デザインレビューにより、`/api/r2/files/:key` エンドポイントのバイナリ/テキスト混合レスポンスが `hc` クライアントの型推論と相性が悪いことが指摘された
- **Alternatives Considered**:
  1. 全エンドポイントを `hc` 経由で呼び出す（元の設計）
  2. ファイル一覧 API のみ `hc` 経由、コンテンツ API は URL 直接アクセス
- **Selected Approach**: ファイル一覧 API（`/api/r2/files`）のみ `hc` 経由、コンテンツ API（`/api/r2/files/:key`）は URL 直接アクセス
- **Rationale**: `hc` クライアントは JSON レスポンスの型推論に最適化されている。バイナリ（画像）やテキスト（Markdown）の混合レスポンスでは型推論が正しく機能しない。画像は `<img src>` で、Markdown は素の `fetch` で取得するのが最も自然なパターン
- **Trade-offs**: コンテンツ取得は型安全でなくなるが、バイナリデータの型安全性は実質的に意味がない
- **Follow-up**: なし（設計で確定）

### Decision: getApp 戻り値型アノテーションの削除

- **Context**: デザインレビューにより、`getApp` の明示的な戻り値型 `: Hono<{ Bindings: Env }>` が Hono RPC 型推論チェーンを破壊することが指摘された
- **Code Evidence**:
  - 現在のコード: `export const getApp = (...): Hono<{ Bindings: Env }> => { ... }` -- 戻り値型が `Hono<{ Bindings: Env }>` に固定されるため、`.route()` チェーンのルート型情報が消失する
  - 参考プロジェクト: `export const getApp = (...) => { ... }` -- 戻り値型アノテーションなし、TypeScript が `.route()` チェーンの完全な型を推論する
- **Alternatives Considered**:
  1. 明示的な戻り値型を維持し、別の方法で型エクスポートする（不可能: 型情報が消失するため）
  2. 戻り値型アノテーションを削除し、TypeScript の型推論に依存する
- **Selected Approach**: 戻り値型アノテーションを削除する
- **Rationale**: Hono の `hc` クライアントは `typeof app` から各ルートのパス・メソッド・レスポンス型を推論する。明示的な型アノテーションがあると、`.get()`, `.route()` 等で構築されたルート情報がジェネリクス型に含まれず、`hc` が空のルート型を推論してしまう
- **Trade-offs**: ESLint の `@typescript-eslint/explicit-function-return-type` ルールに違反するため、`eslint-disable-next-line` コメントが必要
- **Follow-up**: 既存テスト（`app/backend/index.test.ts`）への影響を実装時に確認する

## Risks & Mitigations

- D1 メタデータと R2 オブジェクトの不整合リスク -- デモ用途のため手動同期（スクリプト or マイグレーション）で対応する。将来的に同期メカニズムの構築を検討する。
- Hono RPC クライアントのバイナリレスポンス対応 -- `hc` は JSON レスポンスの型推論に最適化されている。画像は `<img src>` URL 直接指定、Markdown は素の `fetch` で取得する。`hc` 経由でのバイナリ取得は行わない。
- R2 バケットの初期セットアップ -- 開発環境で `wrangler r2 object put` または Wrangler ダッシュボードで手動アップロードする。テスト用ファイルの準備手順をドキュメント化する。
- getApp 戻り値型削除による既存テストへの影響 -- `app/backend/index.test.ts` で `getApp` を呼び出しているテストがあるため、型アノテーション削除後もテストが通ることを確認する。TypeScript の型推論が正しく動作すれば影響はないが、明示的な型に依存しているテストコードがあれば修正が必要。

## References

- [Wrangler Configuration - Cloudflare Workers docs](https://developers.cloudflare.com/workers/wrangler/configuration/) -- R2 バインディング設定の公式ドキュメント
- [Use R2 from Workers - Cloudflare R2 docs](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) -- R2 Workers API の使用方法
- [Workers API reference - Cloudflare R2 docs](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) -- R2Bucket, R2Object, R2ObjectBody の型リファレンス
- [RPC - Hono docs](https://hono.dev/docs/guides/rpc) -- Hono RPC クライアントの公式ガイド
- [Hono Stacks](https://hono.dev/docs/concepts/stacks) -- Hono フルスタック型安全開発の概念
