# Requirements Document

## Project Description (Input)

Cloudflare R2 のセットアップをしてください。bucket に配置した画像ファイルや Markdown ファイルをアプリケーションから取得できるようにします。D1 のときと同じように、デモアプリを作ります。

## Introduction

本仕様は、Cloudflare R2 オブジェクトストレージをプロジェクトにセットアップし、R2 バケットに配置された画像ファイルおよび Markdown ファイルをアプリケーションから取得・表示するデモアプリケーションを構築するための要件を定義する。既存の D1 デモ（Counter Demo）と同様のパターンに従い、Hono バックエンド API + React Router フロントエンドの構成で実装する。参考プロジェクト（`tmp/yantene.net.old`）の R2 利用パターン（`R2Bucket` バインディング、DDD 値オブジェクト、ストレージインターフェース、D1 メタデータ管理、Hono RPC クライアント）を踏襲する。

## Requirements

### Requirement 1: R2 バケットバインディングの設定

**Objective:** As a 開発者, I want wrangler.jsonc に R2 バケットのバインディング設定を追加する, so that アプリケーションコードから `context.env.R2` 経由で R2 バケットにアクセスできるようになる

#### Acceptance Criteria

1. The wrangler.jsonc shall `r2_buckets` セクションにバインディング名 `R2` でバケット設定を含む
2. The wrangler.jsonc shall 開発環境用バケット名（例: `yantene-development`）を設定する
3. Where 本番環境設定が含まれる場合, the wrangler.jsonc shall `env.production` にも本番用 R2 バケット設定を含む
4. The Env 型定義 shall `R2` プロパティとして `R2Bucket` 型を含む

### Requirement 2: R2 ファイル一覧取得 API

**Objective:** As a フロントエンド開発者, I want R2 バケット内のファイル一覧を取得する API エンドポイントを利用する, so that バケットに格納されたオブジェクトをブラウザ上で一覧表示できる

#### Acceptance Criteria

1. The Hono バックエンド shall `/api/r2/files` エンドポイントで R2 バケット内のオブジェクト一覧を JSON 形式で返却する
2. When `/api/r2/files` にGETリクエストが送信された場合, the API shall 各オブジェクトのキー名、サイズ、Content-Type を含むリストを返却する
3. The API レスポンス shall 画像ファイルと Markdown ファイルの両方を含む
4. If R2 バケットへのアクセスに失敗した場合, the API shall 適切な HTTP エラーステータスとエラーメッセージを返却する

### Requirement 3: R2 ファイルコンテンツ取得 API

**Objective:** As a フロントエンド開発者, I want R2 バケットから個別のファイルコンテンツを取得する API エンドポイントを利用する, so that 画像や Markdown のコンテンツをブラウザ上でレンダリングできる

#### Acceptance Criteria

1. The Hono バックエンド shall `/api/r2/files/:key` エンドポイントで指定されたキーのオブジェクトコンテンツを返却する
2. When 画像ファイルのキーが指定された場合, the API shall 適切な Content-Type ヘッダー（例: `image/png`, `image/jpeg`）付きでバイナリデータを返却する
3. When Markdown ファイルのキーが指定された場合, the API shall `text/plain` または `text/markdown` の Content-Type ヘッダー付きでテキストデータを返却する
4. If 指定されたキーのオブジェクトが存在しない場合, the API shall HTTP 404 ステータスとエラーメッセージを返却する
5. If R2 バケットへのアクセスに失敗した場合, the API shall HTTP 500 ステータスとエラーメッセージを返却する

### Requirement 4: R2 デモページ（フロントエンド）

**Objective:** As a ユーザー, I want R2 バケットのファイルをブラウザで閲覧できるデモページを利用する, so that R2 統合が正しく動作していることを確認できる

#### Acceptance Criteria

1. The React Router フロントエンド shall `/r2` パスで R2 デモページを表示する
2. When R2 デモページが読み込まれた場合, the デモページ shall Hono RPC クライアントを使用して R2 バケット内のファイル一覧を取得して表示する
3. The ファイル一覧 shall 各ファイルのキー名とファイルタイプ（画像 / Markdown）を表示する
4. When ファイル一覧の中の画像ファイルが選択された場合, the デモページ shall 画像をインラインでプレビュー表示する
5. When ファイル一覧の中の Markdown ファイルが選択された場合, the デモページ shall Markdown のテキスト内容を表示する
6. While ファイル一覧またはコンテンツを取得中の場合, the デモページ shall ローディング状態を表示する
7. If ファイル取得でエラーが発生した場合, the デモページ shall エラーメッセージを表示する
8. The デモページ shall React Router の loader を使用せず、クライアントサイドから Hono RPC クライアント経由で API を呼び出す

### Requirement 5: DDD アーキテクチャ（参考プロジェクト準拠）

**Objective:** As a 開発者, I want R2 アクセス層が参考プロジェクトの DDD アーキテクチャパターンに従う, so that コードベースの一貫性と保守性が維持される

#### Acceptance Criteria

1. The ドメイン層 shall R2 ストレージアクセスのインターフェース（`app/backend/domain/` 配下）を定義する
2. The ドメイン層 shall R2 オブジェクトを表現する値オブジェクト（例: `ObjectKey`, `ETag` 等）を定義し、バリデーションロジックを含む
3. The インフラ層 shall R2 ストレージインターフェースの具体実装（`app/backend/infra/r2/` 配下）を提供する
4. The R2 ストレージ実装 shall `R2Bucket` バインディングを受け取り、オブジェクトの一覧取得と個別取得の操作を提供する
5. The Hono API ハンドラー shall `app/backend/handlers/api/r2/` 配下に配置し、ハンドラー内でストレージ実装をインスタンス化する

### Requirement 6: D1 メタデータ管理

**Objective:** As a 開発者, I want R2 オブジェクトのメタデータを D1 データベースで管理する, so that 高速なメタデータ検索と R2 オブジェクトのキャッシュ検証が可能になる

#### Acceptance Criteria

1. The D1 スキーマ shall R2 オブジェクトのメタデータテーブル（キー名、サイズ、Content-Type、ETag 等）を含む
2. The バックエンド shall D1 メタデータリポジトリのインターフェース（`app/backend/domain/` 配下）を定義する
3. The バックエンド shall D1 メタデータリポジトリの具体実装（`app/backend/infra/d1/` 配下）を Drizzle ORM で提供する
4. The ファイル一覧 API shall D1 からメタデータを取得してレスポンスを構築する
5. The D1 メタデータ shall R2 オブジェクトの ETag を保持し、キャッシュ検証に利用できる

### Requirement 7: Hono RPC クライアント統合

**Objective:** As a フロントエンド開発者, I want Hono RPC クライアントを使用して R2 API を呼び出す, so that 型安全な API 通信を実現できる

#### Acceptance Criteria

1. The R2 API ハンドラー shall Hono の型推論が有効なルート定義を提供する
2. The フロントエンド shall `hc` (Hono Client) を使用して R2 API エンドポイントを型安全に呼び出す
3. The API レスポンス型 shall フロントエンドとバックエンドで共有され、型の不整合が発生しない

### Requirement 8: ルーティング統合

**Objective:** As a 開発者, I want R2 デモのルーティングが既存のルーティング構成に統合される, so that アプリケーション全体のナビゲーションが一貫する

#### Acceptance Criteria

1. The `app/frontend/routes.ts` shall `/r2` ルートを含む
2. The Hono バックエンド shall `/api/r2` 配下のルートを既存の API ルーティングに追加する
3. The R2 デモページ shall D1 Counter デモと同様に、meta 情報（title, description）を設定する
