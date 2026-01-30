# Requirements Document

## Project Description (Input)

Cloudflare R2 バケットに配置したファイルの一覧表示とダウンロードができるデモアプリを作成する。D1 クリックカウンターデモの改造版として、ファイルダウンロードカウンターを実装する。

## Introduction

本仕様は、オブジェクトストレージ内のファイル一覧表示とダウンロード機能を提供するデモアプリケーションを定義する。既存の D1 クリックカウンターデモを拡張し、ファイルのダウンロード回数をカウントする機能を実装する。オブジェクトストレージのメタデータをデータベースに同期し、ダウンロード時にカウンターをインクリメントする。既存のドメイン層（`ObjectKey`, `ContentType`, `ETag`, `ObjectStorageFileMetadata`）を活用する。

**インフラストラクチャ実装**: Cloudflare R2（オブジェクトストレージ）、Cloudflare D1（リレーショナルデータベース）

## Requirements

### Requirement 1: ファイル一覧画面

**Objective:** As a ユーザー, I want オブジェクトストレージ内のファイル一覧を閲覧する, so that ダウンロード可能なファイルを確認できる

#### Acceptance Criteria

1. The フロントエンド shall `GET /files` でファイル一覧画面を表示する
2. When 一覧画面が表示された場合, the UI shall 各ファイルのキー名、サイズ、Content-Type、ダウンロード回数を表示する
3. The 一覧画面 shall 各ファイルへのダウンロードリンクを提供する
4. If ファイルが存在しない場合, the UI shall 「ファイルがありません」メッセージを表示する

### Requirement 2: ファイルダウンロードエンドポイント

**Objective:** As a ユーザー, I want ファイルをダウンロードする, so that オブジェクトストレージ内のコンテンツを取得できる

#### Acceptance Criteria

1. The バックエンド shall `GET /files/:key` でオブジェクトストレージからファイルを取得して返却する
2. When ファイルがダウンロードされた場合, the システム shall 当該ファイルのダウンロード回数を 1 インクリメントする
3. The レスポンス shall 適切な Content-Type ヘッダーを設定する
4. The レスポンス shall Content-Disposition ヘッダーでダウンロードファイル名を指定する
5. If 指定されたキーのファイルがメタデータに存在しない場合, the API shall HTTP 404 ステータスを返却する
6. If オブジェクトストレージからの取得に失敗した場合, the API shall HTTP 500 ステータスを返却する

### Requirement 3: メタデータ同期 API

**Objective:** As a システム管理者, I want オブジェクトストレージのメタデータをデータベースに同期する, so that ファイル一覧を高速に取得できる

#### Acceptance Criteria

1. The バックエンド shall `POST /api/admin/files/sync` で同期処理を実行する API を提供する
2. When 同期処理が実行された場合, the Sync Service shall オブジェクトストレージ内の全オブジェクト一覧を取得する
3. When 新規オブジェクトが存在する場合, the Sync Service shall メタデータをデータベースに INSERT する（ダウンロード回数は 0 で初期化）
4. When オブジェクトが削除されている場合, the Sync Service shall 対応するレコードをデータベースから DELETE する
5. When オブジェクトの ETag が変更されている場合, the Sync Service shall メタデータを UPDATE する（ダウンロード回数は維持）
6. The API shall 同期結果（追加・削除・更新件数）を JSON 形式で返却する

### Requirement 4: ファイル一覧取得 API

**Objective:** As a フロントエンド, I want ファイルメタデータ一覧を取得する API を利用する, so that 一覧画面を描画できる

#### Acceptance Criteria

1. The バックエンド shall `GET /api/files` でメタデータ一覧を JSON 形式で返却する
2. The レスポンス shall 各ファイルのキー名、サイズ、Content-Type、ETag、ダウンロード回数を含む
3. The API shall Hono RPC の型推論が有効なルート定義を提供する
4. If データベースへのアクセスに失敗した場合, the API shall HTTP 500 ステータスを返却する

### Requirement 5: メタデータスキーマ

**Objective:** As a 開発者, I want ファイルメタデータとダウンロード回数をデータベースで管理する, so that 高速なクエリとカウント更新が可能になる

#### Acceptance Criteria

1. The データベーススキーマ shall `object_storage_file_metadata` テーブルにオブジェクトキー、サイズ、Content-Type、ETag、作成日時、更新日時を含み、`file_download_counts` テーブルにダウンロード回数を含む
2. The データベーススキーマ shall オブジェクトキーをユニークキーとして設定する
3. The ダウンロード回数カラム shall デフォルト値 0 で NOT NULL 制約を持つ
4. The インフラ層 shall Drizzle ORM を使用してスキーマを定義する

### Requirement 6: DDD アーキテクチャの維持

**Objective:** As a 開発者, I want 既存のドメイン層を活用する, so that コードベースの一貫性が保たれる

#### Acceptance Criteria

1. The 実装 shall 既存の値オブジェクト（`ObjectKey`, `ContentType`, `ETag`）を再利用する
2. The 実装 shall 既存のエンティティ（`ObjectStorageFileMetadata`）を拡張してダウンロード回数を追加する
3. The ドメイン層 shall インフラ固有の名前（R2, D1 等）を含まない
4. The インフラ層 shall オブジェクトストレージ実装を `app/backend/infra/r2/` 配下に配置する
5. The インフラ層 shall データベースリポジトリ実装を `app/backend/infra/d1/` 配下に配置する
