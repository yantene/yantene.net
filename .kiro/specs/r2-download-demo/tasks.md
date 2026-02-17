# Implementation Plan

- [x] 1. R2 バケットバインディングと Env 型の設定
  - wrangler.jsonc に `r2_buckets` セクションを追加し、バインディング名 `R2` で開発環境用バケットを設定する
  - 本番環境用の `env.production` にも R2 バケット設定を追加する
  - `wrangler types` を実行して `worker-configuration.d.ts` を再生成し、`Env` 型に `R2: R2Bucket` プロパティが含まれることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. ドメイン層の構築（値オブジェクト・エンティティ・インターフェース）
- [x] 2.1 (P) 値オブジェクトの共通インターフェースを作成する
  - `IValueObject<T>` インターフェースを新規作成し、`equals` と `toJSON` メソッドの契約を定義する
  - 関連する JSON ユーティリティ型（`JsonPrimitive`, `JsonValue`, `IJsonObject`, `IJsonArray`）も同ファイルに定義する
  - 参考プロジェクトのパターンに準拠する
  - _Requirements: 5.2_

- [x] 2.2 (P) R2 ファイル関連の値オブジェクトを作成する
  - `ObjectKey` 値オブジェクト: R2 オブジェクトキーを不変に表現し、空文字列を拒否するバリデーションを含める
  - `ContentType` 値オブジェクト: MIME タイプを不変に表現し、`isImage()` と `isMarkdown()` のヘルパーメソッドを提供する
  - `ETag` 値オブジェクト: R2 オブジェクトの ETag を不変に表現し、キャッシュ検証用途に対応する
  - 全ての値オブジェクトが `IValueObject<T>` インターフェースを実装し、`equals` と `toJSON` を提供する
  - 2.1 の `IValueObject` インターフェースに依存する
  - _Requirements: 5.2, 6.5_

- [x] 2.3 R2 ファイルメタデータエンティティを作成する
  - `R2FileMetadata` エンティティを `IEntity<T>` + `IPersisted` / `IUnpersisted` ジェネリクスパターンで定義する
  - `ObjectKey`, `ContentType`, `ETag` 値オブジェクトを内包し、`size` フィールドが 0 以上であることを検証する
  - `create`（未永続化インスタンス生成）と `reconstruct`（永続化済みインスタンス復元）のファクトリメソッドを提供する
  - `equals` と `toJSON` メソッドを実装する
  - 2.2 の値オブジェクトに依存する
  - _Requirements: 5.1, 6.1_

- [x] 2.4 (P) R2 ストレージとメタデータリポジトリのドメインインターフェースを定義する
  - `IR2FileStorage` インターフェース: `get(objectKey)` メソッドで R2 オブジェクトコンテンツの取得契約を定義する
  - `R2FileContent` 型: `body`（ReadableStream）、`contentType`、`size`、`etag` を含むコンテンツ応答型を定義する
  - `IR2FileMetadataRepository` インターフェース: `findAll()` と `findByObjectKey(objectKey)` メソッドで D1 メタデータアクセス契約を定義する
  - _Requirements: 5.1, 5.4, 6.2_

- [x] 2.5 (P) 値オブジェクトとエンティティの単体テストを作成する
  - `ObjectKey.create` のバリデーション（有効値で生成成功、空文字列で例外）をテストする
  - `ContentType.create` のバリデーションと `isImage()`, `isMarkdown()` ヘルパーの正確性をテストする
  - `ETag.create` のバリデーションをテストする
  - `R2FileMetadata` の `create`, `reconstruct`, `equals`, `toJSON` メソッドをテストする
  - _Requirements: 5.2, 5.1, 6.1_

- [x] 3. D1 メタデータ管理層の構築
- [x] 3.1 D1 メタデータテーブルのスキーマとカスタム型を定義する
  - `r2_file_metadata` テーブルを Drizzle ORM で定義し、`id`, `object_key`, `size`, `content_type`, `etag`, `created_at`, `updated_at` カラムを含める
  - `objectKey`, `contentType`, `etag` のカスタム型を作成し、値オブジェクトとの変換を定義する
  - 既存の `instant` カスタム型を `created_at` と `updated_at` に適用する
  - `object_key` カラムに UNIQUE 制約を設定する
  - スキーマの `index.ts` にテーブルエクスポートを追加する
  - _Requirements: 6.1, 6.5_

- [x] 3.2 D1 マイグレーションファイルを生成する
  - `r2_file_metadata` テーブル作成の SQL マイグレーションを生成する
  - Drizzle Kit の `generate` コマンドでマイグレーションを作成し、SQL の正確性を確認する
  - _Requirements: 6.1_

- [x] 3.3 D1 メタデータリポジトリの具体実装を作成する
  - `IR2FileMetadataRepository` インターフェースを実装し、Drizzle ORM で D1 からメタデータを取得する
  - `findAll` メソッド: 全レコードを取得し `R2FileMetadata.reconstruct` でエンティティに変換する
  - `findByObjectKey` メソッド: 指定キーのレコードを取得し、存在しなければ `undefined` を返却する
  - 既存の `ClickCommandRepository` パターンに準拠する
  - _Requirements: 6.3, 6.4_

- [x] 4. R2 ストレージ実装を作成する (P)
  - `IStoredObjectStorage` インターフェースを実装し、`R2Bucket` バインディングを受け取ってオブジェクト取得操作を提供する
  - `get` メソッド: `R2Bucket.get(key)` を呼び出し、`R2ObjectBody` から `StoredObjectContent` にマッピングする
  - オブジェクトが存在しない場合（`null` 返却時）は `undefined` を返却する
  - `httpMetadata.contentType` が未設定の場合、キーの拡張子から MIME タイプを推定する
  - `R2ObjectBody.body` を `ReadableStream` として `StoredObjectContent` に格納する
  - _Requirements: 5.3, 5.4_

- [x] 5. 共有型定義と Hono RPC 基盤の整備
- [x] 5.1 API レスポンス型をライブラリ層に定義する
  - `R2FileListItem` 型（`key`, `size`, `contentType`, `etag`）を定義する
  - `R2FileListResponse` 型（`files: R2FileListItem[]`）を定義する
  - `R2ErrorResponse` 型（`error: string`）を定義する
  - バックエンドハンドラーから明示的に参照できるよう共有ライブラリに配置する
  - _Requirements: 7.3_

- [x] 5.2 バックエンドのアプリケーション構成を Hono RPC 対応に変更する
  - `getApp` 関数の明示的な戻り値型アノテーションを削除し、TypeScript の型推論で `.route()` チェーンのルート情報を保持する
  - ESLint の `explicit-function-return-type` ルール違反を抑制するコメントを追加する
  - Hono RPC クライアント用の `app` 変数を適切にエクスポートする（アプローチ A またはアプローチ B を採用）
  - 既存テストが変更後も正常に通過することを確認する
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 6. R2 API ハンドラーの実装とルーティング統合
- [x] 6.1 R2 ファイル一覧取得 API エンドポイントを実装する
  - `/api/files` エンドポイント（GET）で D1 メタデータリポジトリから全ファイル情報を取得し、JSON レスポンスを返却する
  - レスポンスに各オブジェクトのキー名、サイズ、Content-Type、ETag を含める
  - Hono RPC 型推論が有効なルート定義を提供する（`c.json()` で返却）
  - D1 アクセス失敗時に HTTP 500 とエラーメッセージを返却する
  - ハンドラー内でリポジトリをインスタンス化する（既存 Counter パターン準拠）
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.1_

- [x] 6.2 R2 ファイルコンテンツ取得 API エンドポイントを実装する
  - `/api/files/:key` エンドポイント（GET）で R2 ストレージから個別ファイルを取得し、適切な Content-Type 付きでレスポンスを返却する
  - ワイルドカードパスを使用してネストされたキー（例: `images/photo.png`）に対応する
  - 画像ファイルは適切な Content-Type ヘッダー（`image/png`, `image/jpeg` 等）付きでバイナリデータを返却する
  - Markdown ファイルは `text/plain` または `text/markdown` の Content-Type 付きでテキストデータを返却する
  - オブジェクト不在時に HTTP 404、R2 アクセス失敗時に HTTP 500 とエラーメッセージを返却する
  - ハンドラー内で R2FileStorage をインスタンス化する（既存 Counter パターン準拠）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6.3 R2 API ルートをバックエンドに統合する
  - Hono バックエンドの `getApp` 内で `/api/r2` 配下に R2 API ルートを `.route()` で接続する
  - 既存の `/api/counter` ルートや `/hello` ルートとの共存を確認する
  - _Requirements: 8.2_

- [x] 7. R2 デモページ（フロントエンド）の実装
- [x] 7.1 R2 デモページのルート設定と基本構造を作成する
  - `/r2` パスでデモページを表示する React Router ルートを追加する
  - `meta` 関数で title と description を設定する（Counter Demo パターン準拠）
  - React Router の loader を使用せず、クライアントサイドのみで動作する構成にする
  - _Requirements: 4.1, 4.8, 8.1, 8.3_

- [x] 7.2 fetch API でファイル一覧を取得して表示する
  - `fetch` を使用して `/api/files` を呼び出し、ファイル一覧を取得する
  - 各ファイルのキー名とファイルタイプ（画像 / Markdown）を一覧表示する
  - ファイル一覧取得中のローディング状態を表示する
  - ファイル一覧取得エラー時にエラーメッセージを表示する
  - _Requirements: 4.2, 4.3, 4.6, 4.7, 7.2_

- [x] 7.3 ファイル選択時のプレビュー表示機能を実装する
  - 画像ファイル選択時: `/api/files/{key}` を `<img>` タグの `src` に直接指定してインラインプレビューする
  - Markdown ファイル選択時: 素の `fetch` で `/api/files/{key}` からテキストを取得し、内容を表示する
  - コンテンツ取得中のローディング状態を表示する
  - コンテンツ取得エラー時にエラーメッセージを表示する
  - _Requirements: 4.4, 4.5, 4.6, 4.7_

- [x] 8. 結合確認とエンドツーエンド動作検証
  - 全レイヤー（wrangler 設定 → ドメイン層 → インフラ層 → ハンドラー → フロントエンド）が正しく統合されていることを確認する
  - R2 バケットにテスト用の画像ファイルと Markdown ファイルを配置し、D1 にメタデータを投入する
  - デモページでファイル一覧の表示、画像プレビュー、Markdown テキスト表示が動作することを検証する
  - エラー系（存在しないキー指定時の 404、API 障害時の画面エラー表示）を検証する
  - 型チェック（`pnpm run typecheck`）とリント（`pnpm run lint`）が通過することを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3_
