# Requirements Document

## Introduction

記事一覧 API (`GET /api/v1/notes`) の要件定義書。D1 データベースの notes テーブルに保存された記事データを、ページネーション付きで一覧取得するための API エンドポイントを定義する。既存の Note ドメインモデル、クエリリポジトリ、および notes-refresh-api (`POST /api/v1/notes/refresh`) と同じ Hono ルートグループ上にエンドポイントを追加する。

## Requirements

### Requirement 1: 記事一覧の取得

**Objective:** As a フロントエンド開発者, I want 公開日降順でソートされた記事の一覧を取得したい, so that ウェブサイトの記事一覧ページを表示できる

#### Acceptance Criteria

1. When `GET /api/v1/notes` リクエストを受信した, the Notes List API shall 公開日 (`publishedOn`) の降順でソートされた記事一覧を JSON レスポンスとして返却する
2. The Notes List API shall 各記事について id, title, slug, imageUrl, publishedOn, lastModifiedOn を含むオブジェクトをレスポンスに含める
3. The Notes List API shall レスポンスの HTTP ステータスコードとして 200 を返却する
4. The Notes List API shall レスポンスの Content-Type として `application/json` を返却する

### Requirement 2: ページネーション

**Objective:** As a フロントエンド開発者, I want ページネーションパラメータを指定して記事一覧を分割取得したい, so that 大量の記事データを効率的にロードできる

#### Acceptance Criteria

1. When `page` クエリパラメータが指定された, the Notes List API shall 該当ページの記事一覧を返却する
2. When `page` クエリパラメータが省略された, the Notes List API shall 1ページ目の記事一覧を返却する
3. When `per-page` クエリパラメータが指定された, the Notes List API shall 指定された件数分の記事を返却する
4. When `per-page` クエリパラメータが省略された, the Notes List API shall デフォルトのページサイズ (20件) で記事を返却する
5. The Notes List API shall レスポンスにページネーションメタデータ (現在のページ番号, 1ページあたりの件数, 総件数, 総ページ数) を含める

### Requirement 3: ページネーションパラメータのバリデーション

**Objective:** As a フロントエンド開発者, I want 不正なページネーションパラメータに対して明確なエラーレスポンスを受け取りたい, so that クライアント側で適切にエラーハンドリングできる

#### Acceptance Criteria

1. If `page` パラメータが正の整数でない値を指定された, the Notes List API shall HTTP ステータスコード 400 と RFC 9457 準拠の Problem Details エラーレスポンスを返却する
2. If `per-page` パラメータが正の整数でない値を指定された, the Notes List API shall HTTP ステータスコード 400 と RFC 9457 準拠の Problem Details エラーレスポンスを返却する
3. If `per-page` パラメータが許容最大値 (100件) を超えた値を指定された, the Notes List API shall HTTP ステータスコード 400 と RFC 9457 準拠の Problem Details エラーレスポンスを返却する
4. If `page` パラメータが総ページ数を超える値を指定された, the Notes List API shall 空の記事配列とページネーションメタデータを含むレスポンスを返却する

### Requirement 4: レスポンス形式

**Objective:** As a フロントエンド開発者, I want 一貫したレスポンス構造で記事一覧を受け取りたい, so that クライアント側での型安全なデータ処理が可能になる

#### Acceptance Criteria

1. The Notes List API shall レスポンスボディを `{ notes: [...], pagination: {...} }` の構造で返却する
2. The Notes List API shall `notes` 配列内の各オブジェクトに `id`, `title`, `slug`, `imageUrl`, `publishedOn`, `lastModifiedOn` フィールドを含める
3. The Notes List API shall `pagination` オブジェクトに `page`, `perPage`, `totalCount`, `totalPages` フィールドを含める
4. The Notes List API shall 日付フィールド (`publishedOn`, `lastModifiedOn`) を ISO 8601 形式の文字列として返却する

### Requirement 5: エラーハンドリング

**Objective:** As a フロントエンド開発者, I want データベースエラー時に適切なエラーレスポンスを受け取りたい, so that ユーザーに適切なフィードバックを表示できる

#### Acceptance Criteria

1. If データベースへのクエリ実行中にエラーが発生した, the Notes List API shall HTTP ステータスコード 500 と RFC 9457 準拠の Problem Details エラーレスポンスを返却する
2. If 内部エラーが発生した, the Notes List API shall エラーの詳細をサーバーログに出力する
3. The Notes List API shall エラーレスポンスの Content-Type として `application/problem+json` を返却する

### Requirement 6: 既存ルートグループへの統合

**Objective:** As a バックエンド開発者, I want 既存の notes ルートグループにエンドポイントを追加したい, so that API の一貫性とコードの整理を維持できる

#### Acceptance Criteria

1. The Notes List API shall 既存の `notesApp` Hono ルートグループ (`/api/v1/notes`) に GET ハンドラとして追加される
2. The Notes List API shall 既存の `POST /api/v1/notes/refresh` エンドポイントに影響を与えない
3. The Notes List API shall 既存の `INoteQueryRepository` インターフェースおよび `NoteQueryRepository` 実装を活用する
