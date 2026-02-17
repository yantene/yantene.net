# Requirements Document

## Introduction

本ドキュメントでは、記事（Note）ドメインモデルの要件を定義する。Note エンティティと関連する値オブジェクト（NoteTitle, NoteSlug, Etag, ImageUrl）の作成、D1 上の notes テーブル定義、および CQRS パターンに基づく NoteQueryRepository / NoteCommandRepository の実装に関する要件を網羅する。既存の StoredObjectMetadata エンティティや ETag 値オブジェクトなどのドメインパターンに準拠し、プロジェクトのクリーンアーキテクチャ原則を維持する。

## Requirements

### Requirement 1: Note エンティティの定義

**Objective:** As a 開発者, I want Note エンティティを IPersisted / IUnpersisted ジェネリクスに対応した形で定義したい, so that コンパイル時に永続化状態を区別でき、未保存のエンティティを永続化済みとして誤用することを防げる

#### Acceptance Criteria

1. The Note エンティティ shall IEntity インターフェースを実装し、private コンストラクタ・`create` ファクトリメソッド・`reconstruct` ファクトリメソッドを持つ
2. When `create` ファクトリメソッドが呼ばれたとき, the Note エンティティ shall id, createdAt, updatedAt が undefined である IUnpersisted 状態のインスタンスを返す
3. When `reconstruct` ファクトリメソッドが id, createdAt, updatedAt を含むパラメータで呼ばれたとき, the Note エンティティ shall IPersisted 状態のインスタンスを返す
4. The Note エンティティ shall NoteTitle, NoteSlug, ETag, ImageUrl の各値オブジェクトをプロパティとして保持する
5. The Note エンティティ shall すべてのプロパティを readonly として公開する
6. The Note エンティティ shall `equals` メソッドにより、永続化済みインスタンス同士を id で比較し、未永続化インスタンスの場合は参照一致で比較する
7. The Note エンティティ shall `toJSON` メソッドにより、すべてのプロパティをシリアライズ可能な形式で返す

### Requirement 2: NoteTitle 値オブジェクトの定義

**Objective:** As a 開発者, I want NoteTitle 値オブジェクトで記事タイトルのバリデーションとカプセル化を行いたい, so that 不正なタイトルがドメインモデルに入り込むことを防げる

#### Acceptance Criteria

1. The NoteTitle 値オブジェクト shall IValueObject インターフェースを実装し、private コンストラクタと `create` ファクトリメソッドを持つ
2. When 空文字列で `create` が呼ばれたとき, the NoteTitle 値オブジェクト shall エラーをスローする
3. The NoteTitle 値オブジェクト shall `equals` メソッドにより値の等価比較を行う
4. The NoteTitle 値オブジェクト shall `toJSON` メソッドにより文字列値を返す

### Requirement 3: NoteSlug 値オブジェクトの定義

**Objective:** As a 開発者, I want NoteSlug 値オブジェクトで記事の URL スラッグをバリデーション・カプセル化したい, so that URL に安全なスラッグのみがドメインモデルで使用されることを保証できる

#### Acceptance Criteria

1. The NoteSlug 値オブジェクト shall IValueObject インターフェースを実装し、private コンストラクタと `create` ファクトリメソッドを持つ
2. When 空文字列で `create` が呼ばれたとき, the NoteSlug 値オブジェクト shall エラーをスローする
3. If スラッグとして不正な文字列（URL に使用できない文字を含む等）が渡されたとき, the NoteSlug 値オブジェクト shall エラーをスローする
4. The NoteSlug 値オブジェクト shall `equals` メソッドにより値の等価比較を行う
5. The NoteSlug 値オブジェクト shall `toJSON` メソッドにより文字列値を返す

### Requirement 4: ImageUrl 値オブジェクトの定義

**Objective:** As a 開発者, I want ImageUrl 値オブジェクトで画像 URL のバリデーションとカプセル化を行いたい, so that 不正な URL がドメインモデルに入り込むことを防げる

#### Acceptance Criteria

1. The ImageUrl 値オブジェクト shall IValueObject インターフェースを実装し、private コンストラクタと `create` ファクトリメソッドを持つ
2. When 空文字列で `create` が呼ばれたとき, the ImageUrl 値オブジェクト shall エラーをスローする
3. If 不正な URL 形式の文字列が渡されたとき, the ImageUrl 値オブジェクト shall エラーをスローする
4. The ImageUrl 値オブジェクト shall `equals` メソッドにより値の等価比較を行う
5. The ImageUrl 値オブジェクト shall `toJSON` メソッドにより文字列値を返す

### Requirement 5: ETag 値オブジェクトの共有カーネルへの移動と再利用

**Objective:** As a 開発者, I want ETag 値オブジェクトを集約横断の共有カーネルに移動し、Note エンティティおよび StoredObjectMetadata エンティティの両方から参照したい, so that 集約境界を適切に維持しつつ、ドメイン全体で一貫した ETag の扱いを実現できる

#### Acceptance Criteria

1. The ETag 値オブジェクト shall `app/backend/domain/stored-object/etag.vo.ts` から `app/backend/domain/shared/etag.vo.ts` に移動される
2. The ETag 値オブジェクトのテストファイル shall `app/backend/domain/stored-object/etag.vo.test.ts` から `app/backend/domain/shared/etag.vo.test.ts` に移動される
3. The StoredObjectMetadata エンティティ shall 移動後の `app/backend/domain/shared/etag.vo.ts` から ETag をインポートするように更新される
4. The Note エンティティ shall `app/backend/domain/shared/etag.vo.ts` から ETag をインポートして使用する
5. The Note ドメイン shall ETag 値オブジェクトを新規に定義しない
6. The 既存のインフラ層（D1 リポジトリ等）の ETag インポートパス shall 共有カーネルのパスに更新される

### Requirement 6: notes テーブルの定義

**Objective:** As a 開発者, I want D1 上に notes テーブルを Drizzle ORM のスキーマとして定義したい, so that Note エンティティの永続化基盤を構築できる

#### Acceptance Criteria

1. The notes テーブルスキーマ shall id（テキスト型・主キー）、title（テキスト型・必須）、slug（テキスト型・必須・ユニーク）、etag（テキスト型・必須）、imageUrl（テキスト型・必須）、createdAt（Temporal.Instant 型・必須・デフォルト値あり）、updatedAt（Temporal.Instant 型・必須・デフォルト値あり）のカラムを含む
2. The notes テーブルスキーマ shall 既存の `instant` カスタム型を createdAt および updatedAt カラムに使用する
3. The notes テーブルスキーマ shall D1 スキーマの `index.ts` からエクスポートされる

### Requirement 7: NoteCommandRepository インターフェースの定義

**Objective:** As a 開発者, I want CQRS パターンに基づく書き込み専用のリポジトリインターフェースを定義したい, so that コマンド操作（作成・更新・削除）をクエリ操作と分離できる

#### Acceptance Criteria

1. The INoteCommandRepository インターフェース shall Note エンティティの保存メソッドを定義し、IUnpersisted 状態の Note を受け取り IPersisted 状態の Note を返す
2. The INoteCommandRepository インターフェース shall Note エンティティの削除メソッドを定義する
3. The INoteCommandRepository インターフェース shall ドメイン層（`app/backend/domain/note/`）に配置される

### Requirement 8: NoteQueryRepository インターフェースの定義

**Objective:** As a 開発者, I want CQRS パターンに基づく読み取り専用のリポジトリインターフェースを定義したい, so that クエリ操作をコマンド操作と分離し、読み取り最適化を可能にする

#### Acceptance Criteria

1. The INoteQueryRepository インターフェース shall 全件取得メソッドを定義し、IPersisted 状態の readonly Note 配列を返す
2. The INoteQueryRepository インターフェース shall スラッグによる検索メソッドを定義し、IPersisted 状態の Note または undefined を返す
3. The INoteQueryRepository インターフェース shall ドメイン層（`app/backend/domain/note/`）に配置される

### Requirement 9: NoteCommandRepository の D1 実装

**Objective:** As a 開発者, I want INoteCommandRepository の D1 による具象実装を作成したい, so that Note エンティティを Cloudflare D1 データベースに永続化できる

#### Acceptance Criteria

1. The D1 NoteCommandRepository shall INoteCommandRepository インターフェースを実装する
2. The D1 NoteCommandRepository shall インフラ層（`app/backend/infra/d1/note/`）に配置される
3. When save メソッドが IUnpersisted 状態の Note で呼ばれたとき, the D1 NoteCommandRepository shall notes テーブルにレコードを挿入し、IPersisted 状態の Note を返す
4. When delete メソッドが呼ばれたとき, the D1 NoteCommandRepository shall 指定された Note のレコードを notes テーブルから削除する

### Requirement 10: NoteQueryRepository の D1 実装

**Objective:** As a 開発者, I want INoteQueryRepository の D1 による具象実装を作成したい, so that Cloudflare D1 データベースから Note エンティティを読み取れる

#### Acceptance Criteria

1. The D1 NoteQueryRepository shall INoteQueryRepository インターフェースを実装する
2. The D1 NoteQueryRepository shall インフラ層（`app/backend/infra/d1/note/`）に配置される
3. When findAll メソッドが呼ばれたとき, the D1 NoteQueryRepository shall notes テーブルの全レコードを取得し、IPersisted 状態の Note 配列として返す
4. When findBySlug メソッドが NoteSlug で呼ばれたとき, the D1 NoteQueryRepository shall 該当するレコードを取得し IPersisted 状態の Note を返すか、存在しない場合は undefined を返す

### Requirement 11: ドメイン層のインフラ非依存性

**Objective:** As a 開発者, I want ドメイン層がインフラストラクチャ技術に依存しないことを保証したい, so that 将来のインフラ変更（D1 から他のデータベースへの移行等）にドメイン層が影響されない

#### Acceptance Criteria

1. The Note ドメインモデル（エンティティ・値オブジェクト・リポジトリインターフェース） shall クラス名・インターフェース名・型名にインフラ技術名（D1, R2, Cloudflare 等）を含まない
2. The Note ドメインモデル shall Hono やその他の HTTP プリミティブをインポートしない
3. The Note ドメインモデル shall Drizzle ORM やその他のデータベースライブラリを直接インポートしない
