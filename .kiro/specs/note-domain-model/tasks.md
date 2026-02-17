# Implementation Plan

- [x] 1. ETag 値オブジェクトを共有カーネルに移動する
  - ETag 値オブジェクトとそのテストファイルを stored-object ディレクトリから共有カーネルディレクトリに移動する
  - 移動先のディレクトリ構造を作成し、ETag の IValueObject インターフェースへのインポートパスを更新する
  - StoredObjectMetadata エンティティおよびそのテストファイルの ETag インポートパスを共有カーネルに変更する
  - インフラ層（D1 リポジトリ、R2 ストレージ）、サービス層、ハンドラ層の ETag インポートパスを共有カーネルに変更する
  - 全テストを実行し、移動後もすべてのインポートが正しく解決され既存の振る舞いが維持されることを確認する
  - _Requirements: 5.1, 5.2, 5.3, 5.6_

- [x] 2. Note 集約の値オブジェクトを定義する
- [x] 2.1 (P) NoteTitle 値オブジェクトを作成する
  - 記事タイトルをカプセル化する値オブジェクトを定義する
  - private コンストラクタと create ファクトリメソッドを実装し、空文字列の場合はエラーをスローする
  - equals メソッドで値の等価比較、toJSON メソッドで文字列値のシリアライズを提供する
  - TDD で実装する：正常値での生成、空文字列でのエラースロー、equals の等価比較、toJSON の出力を検証するテストを先に書く
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2.2 (P) NoteSlug 値オブジェクトを作成する
  - URL スラッグをカプセル化する値オブジェクトを定義する
  - private コンストラクタと create ファクトリメソッドを実装し、空文字列および URL に安全でない文字列（英小文字・数字・ハイフンのみ許可、先頭・末尾・連続ハイフン禁止）の場合はエラーをスローする
  - equals メソッドで値の等価比較、toJSON メソッドで文字列値のシリアライズを提供する
  - TDD で実装する：有効なスラッグでの生成、空文字列でのエラー、不正文字列（大文字・記号・先頭ハイフン等）でのエラー、equals / toJSON の動作を検証するテストを先に書く
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2.3 (P) ImageUrl 値オブジェクトを作成する
  - 画像 URL をカプセル化する値オブジェクトを定義する
  - private コンストラクタと create ファクトリメソッドを実装し、空文字列および不正な URL 形式の場合はエラーをスローする
  - equals メソッドで値の等価比較、toJSON メソッドで文字列値のシリアライズを提供する
  - TDD で実装する：正常 URL での生成、空文字列でのエラー、不正 URL 形式でのエラー、equals / toJSON の動作を検証するテストを先に書く
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. Note エンティティを定義する
  - 記事を表すドメインエンティティを IPersisted / IUnpersisted ジェネリクスに対応した形で定義する
  - create ファクトリメソッドで id, createdAt, updatedAt が undefined の IUnpersisted 状態のインスタンスを返す
  - reconstruct ファクトリメソッドで id, createdAt, updatedAt を含む全フィールドが設定された IPersisted 状態のインスタンスを返す
  - NoteTitle, NoteSlug, ETag（共有カーネルから参照）, ImageUrl の各値オブジェクトをプロパティとして保持し、すべて readonly で公開する
  - equals メソッドで永続化済み同士は id 比較、未永続化同士は参照一致で比較する
  - toJSON メソッドで全プロパティをシリアライズ可能な形式で返す
  - ETag は新規に定義せず、共有カーネルからインポートして再利用する
  - ドメイン層にインフラ技術名・HTTP プリミティブ・ORM ライブラリのインポートが含まれないことを確認する
  - TDD で実装する：create による IUnpersisted 生成、reconstruct による IPersisted 生成、equals の比較動作、toJSON の出力、readonly プロパティの確認を検証するテストを先に書く
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.4, 5.5, 11.1, 11.2, 11.3_

- [ ] 4. CQRS リポジトリインターフェースを定義する
- [ ] 4.1 (P) NoteCommandRepository インターフェースを定義する
  - 書き込み専用のリポジトリインターフェースをドメイン層に定義する
  - IUnpersisted 状態の Note を受け取り IPersisted 状態の Note を返す保存メソッドを定義する
  - 指定 id の Note を削除する削除メソッドを定義する
  - インターフェース名・型名にインフラ技術名を含めない
  - _Requirements: 7.1, 7.2, 7.3, 11.1, 11.2, 11.3_

- [ ] 4.2 (P) NoteQueryRepository インターフェースを定義する
  - 読み取り専用のリポジトリインターフェースをドメイン層に定義する
  - 全件取得メソッドで IPersisted 状態の Note の readonly 配列を返す
  - スラッグによる検索メソッドで IPersisted 状態の Note または undefined を返す
  - インターフェース名・型名にインフラ技術名を含めない
  - _Requirements: 8.1, 8.2, 8.3, 11.1, 11.2, 11.3_

- [ ] 5. notes テーブルスキーマを定義する
  - D1 上の notes テーブルを Drizzle ORM スキーマとして定義する
  - id（テキスト型・主キー）、title（テキスト型・必須）、slug（テキスト型・必須・ユニーク制約）、etag（テキスト型・必須）、imageUrl（テキスト型・必須）、createdAt（instant カスタム型・必須・デフォルト値）、updatedAt（instant カスタム型・必須・デフォルト値）のカラムを含める
  - 既存の instant カスタム型を createdAt / updatedAt に使用する
  - D1 スキーマのエクスポートファイルに notes テーブルのエクスポートを追加する
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6. NoteQueryRepository の D1 実装を作成する
  - INoteQueryRepository インターフェースを実装する D1 具象クラスをインフラ層に作成する
  - findAll メソッドで notes テーブルの全レコードを取得し、各行を値オブジェクトの再構築と Note.reconstruct を通じて IPersisted 状態の Note 配列として返す
  - findBySlug メソッドで slug 一致レコードを取得し、存在すれば IPersisted 状態の Note を返し、存在しなければ undefined を返す
  - DB 行からドメインエンティティへの変換ロジックを実装する
  - TDD で実装する：findAll による全件取得、findBySlug による一致レコード取得、存在しない slug での undefined 返却を検証するテストを先に書く
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 7. NoteCommandRepository の D1 実装を作成する
  - INoteCommandRepository インターフェースを実装する D1 具象クラスをインフラ層に作成する
  - save メソッドで UUID 生成とタイムスタンプ設定を行い、notes テーブルにレコードを挿入し、NoteQueryRepository 経由で挿入結果を取得して IPersisted 状態の Note を返す
  - delete メソッドで指定 id のレコードを notes テーブルから削除する
  - NoteQueryRepository をコンストラクタの依存として受け取り、save 後の結果取得に利用する
  - TDD で実装する：save による INSERT と IPersisted 状態の Note 返却、delete によるレコード削除を検証するテストを先に書く
  - _Requirements: 9.1, 9.2, 9.3, 9.4_
