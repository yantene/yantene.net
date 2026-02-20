# Requirements Document

## Introduction

記事詳細 API の要件定義書。2つの API エンドポイントを定義する。
1. **記事詳細 API** (`GET /api/v1/notes/{noteSlug}`) -- 記事のメタデータに加え、Markdown 本文を mdast (Markdown Abstract Syntax Tree) 形式で返す。mdast 内の相対画像パスはアセット配信 API の URL に解決する。
2. **アセット配信 API** (`GET /api/v1/notes/{noteSlug}/assets/{assetPath}`) -- 記事に紐づく画像等のアセットファイルをバイナリストリームとして配信する。

既存の Note ドメインモデル、`INoteQueryRepository`、`IMarkdownStorage`、`IAssetStorage` インターフェース、および `notesApp` Hono ルートグループ上にエンドポイントを追加する。

## Requirements

### Requirement 1: 記事詳細の取得

**Objective:** As a フロントエンド開発者, I want slug を指定して記事のメタデータと Markdown 本文を取得したい, so that 記事詳細ページをレンダリングできる

#### Acceptance Criteria

1. When `GET /api/v1/notes/{noteSlug}` リクエストを受信した, the Note Detail API shall 該当記事のメタデータと Markdown 本文を JSON レスポンスとして返却する
2. The Note Detail API shall レスポンスに id, title, slug, imageUrl, publishedOn, lastModifiedOn をメタデータとして含める
3. The Note Detail API shall レスポンスの HTTP ステータスコードとして 200 を返却する
4. The Note Detail API shall レスポンスの Content-Type として `application/json` を返却する

### Requirement 2: Markdown 本文の mdast 変換

**Objective:** As a フロントエンド開発者, I want Markdown 本文を mdast (Markdown Abstract Syntax Tree) 形式で受け取りたい, so that フロントエンドで柔軟にレンダリング制御できる

#### Acceptance Criteria

1. The Note Detail API shall Markdown 本文から frontmatter を除去した本文部分を mdast に変換してレスポンスに含める
2. The Note Detail API shall mdast を `content` フィールドとしてレスポンスボディに含める
3. The Note Detail API shall mdast の変換に unist/mdast 準拠のパーサーを使用する

### Requirement 3: mdast 内の相対画像パス解決

**Objective:** As a フロントエンド開発者, I want mdast 内の画像 URL がアセット配信 API を指すようにしたい, so that 記事内の画像をフロントエンドからそのまま表示できる

#### Acceptance Criteria

1. When mdast 内の image ノードの url が相対パスである, the Note Detail API shall そのパスをアセット配信 API のURL (`/api/v1/notes/{noteSlug}/assets/{assetPath}`) に解決する
2. When mdast 内の image ノードの url が絶対 URL (http:// または https://) である, the Note Detail API shall そのURLを変更せずそのまま保持する
3. The Note Detail API shall mdast ツリー全体を走査し、すべての image ノードの相対パスを解決する

### Requirement 4: アセット配信

**Objective:** As a フロントエンド開発者, I want 記事に紐づく画像等のアセットファイルを取得したい, so that 記事詳細ページ内の画像を表示できる

#### Acceptance Criteria

1. When `GET /api/v1/notes/{noteSlug}/assets/{assetPath}` リクエストを受信した, the Asset Delivery API shall 該当アセットのバイナリデータをレスポンスボディとして返却する
2. The Asset Delivery API shall レスポンスの Content-Type にアセットの実際のメディアタイプ (例: `image/png`, `image/jpeg`) を設定する
3. The Asset Delivery API shall レスポンスの HTTP ステータスコードとして 200 を返却する
4. The Asset Delivery API shall アセットの ETag をレスポンスヘッダーに含める

### Requirement 5: 記事が見つからない場合のエラーハンドリング

**Objective:** As a フロントエンド開発者, I want 存在しない記事の slug を指定した場合に明確なエラーレスポンスを受け取りたい, so that クライアント側で適切にエラーハンドリングできる

#### Acceptance Criteria

1. If 指定された noteSlug に該当する記事がデータベースに存在しない, the Note Detail API shall HTTP ステータスコード 404 と RFC 9457 準拠の Problem Details エラーレスポンスを返却する
2. If 指定された noteSlug に該当する Markdown ファイルがストレージに存在しない, the Note Detail API shall HTTP ステータスコード 404 と RFC 9457 準拠の Problem Details エラーレスポンスを返却する
3. If 指定された noteSlug が不正な形式である, the Note Detail API shall HTTP ステータスコード 400 と RFC 9457 準拠の Problem Details エラーレスポンスを返却する

### Requirement 6: アセットが見つからない場合のエラーハンドリング

**Objective:** As a フロントエンド開発者, I want 存在しないアセットパスを指定した場合に明確なエラーレスポンスを受け取りたい, so that クライアント側で適切にエラーハンドリングできる

#### Acceptance Criteria

1. If 指定された assetPath に該当するアセットがストレージに存在しない, the Asset Delivery API shall HTTP ステータスコード 404 と RFC 9457 準拠の Problem Details エラーレスポンスを返却する
2. If 指定された noteSlug が不正な形式である, the Asset Delivery API shall HTTP ステータスコード 400 と RFC 9457 準拠の Problem Details エラーレスポンスを返却する

### Requirement 7: エラーハンドリング共通

**Objective:** As a フロントエンド開発者, I want 内部エラー時に一貫したエラーレスポンスを受け取りたい, so that エラー処理を統一的に実装できる

#### Acceptance Criteria

1. If ストレージまたはデータベースへのアクセス中にエラーが発生した, the Note Detail API shall HTTP ステータスコード 500 と RFC 9457 準拠の Problem Details エラーレスポンスを返却する
2. If 内部エラーが発生した, the Note Detail API shall エラーの詳細をサーバーログに出力する
3. The Note Detail API shall エラーレスポンスの Content-Type として `application/problem+json` を返却する
4. If ストレージまたはデータベースへのアクセス中にエラーが発生した, the Asset Delivery API shall HTTP ステータスコード 500 と RFC 9457 準拠の Problem Details エラーレスポンスを返却する
5. The Asset Delivery API shall エラーレスポンスの Content-Type として `application/problem+json` を返却する

### Requirement 8: レスポンス形式

**Objective:** As a フロントエンド開発者, I want 一貫したレスポンス構造で記事詳細を受け取りたい, so that クライアント側での型安全なデータ処理が可能になる

#### Acceptance Criteria

1. The Note Detail API shall レスポンスボディを `{ id, title, slug, imageUrl, publishedOn, lastModifiedOn, content }` の構造で返却する
2. The Note Detail API shall `content` フィールドに mdast ルートノード (type: "root") を含める
3. The Note Detail API shall 日付フィールド (`publishedOn`, `lastModifiedOn`) を ISO 8601 形式の文字列として返却する

### Requirement 9: 既存ルートグループへの統合

**Objective:** As a バックエンド開発者, I want 既存の notes ルートグループにエンドポイントを追加したい, so that API の一貫性とコードの整理を維持できる

#### Acceptance Criteria

1. The Note Detail API shall 既存の `notesApp` Hono ルートグループ (`/api/v1/notes`) に `GET /:noteSlug` ハンドラとして追加される
2. The Asset Delivery API shall 既存の `notesApp` Hono ルートグループに `GET /:noteSlug/assets/:assetPath` ハンドラとして追加される
3. The Note Detail API shall 既存の `GET /api/v1/notes` (一覧) および `POST /api/v1/notes/refresh` エンドポイントに影響を与えない
4. The Note Detail API shall 既存の `INoteQueryRepository`, `IMarkdownStorage`, `IAssetStorage` インターフェースを活用する
