# Implementation Plan

- [ ] 1. R2 バケットバインディングの追加と型定義の更新
  - wrangler.jsonc に `NOTES_R2` バインディングを development / production 両環境に追加する
  - `wrangler types` を実行して `worker-configuration.d.ts` を再生成し、Env 型に `NOTES_R2` が含まれることを確認する
  - _Requirements: 1.1_

- [ ] 2. frontmatter パースライブラリの導入とパース関数の実装
- [ ] 2.1 (P) frontmatter パース用ライブラリのインストール
  - unified, remark-parse, remark-frontmatter, vfile-matter を pnpm で追加する
  - インストール後にビルドが通ることを確認する
  - _Requirements: 2.1_

- [ ] 2.2 ドメインエラークラスの定義
  - frontmatter のパースに失敗した際のエラーとして、ファイル名情報を含むドメインエラーを実装する
  - 必須メタデータが欠落している場合のバリデーションエラーとして、欠落フィールド名とファイル名を含むドメインエラーを実装する
  - 各エラークラスのメッセージとプロパティが正しいことをテストで検証する
  - _Requirements: 2.3, 2.4_

- [ ] 2.3 Markdown frontmatter パース関数の実装
  - Markdown テキストの YAML frontmatter から title, imageUrl, publishedOn, lastModifiedOn を抽出する純粋関数を実装する
  - publishedOn と lastModifiedOn は ISO 8601 日付文字列から Temporal.PlainDate に変換する
  - パース失敗時にパースエラー、必須フィールド欠落時にバリデーションエラーをスローすることをテストで確認する
  - 正常な frontmatter、フィールド欠落、不正 YAML の各パターンをテストする
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 3. Notes 用オブジェクトストレージインタフェースと R2 実装
- [ ] 3.1 (P) ドメイン層にオブジェクトストレージインタフェースを定義
  - Notes 用 R2 バケットへの一覧取得・個別取得を抽象化するインタフェースを定義する
  - 一覧取得ではオブジェクトキーと etag を返し、個別取得ではオブジェクト本文をテキストとして返す
  - バケットが空の場合は空の一覧を返す仕様とする
  - _Requirements: 1.1, 1.2, 1.3_
  - _Contracts: INoteObjectStorage_

- [ ] 3.2 R2 を利用したオブジェクトストレージの実装
  - ドメインインタフェースを R2 バインディング (NOTES_R2) で実装する
  - list() で全 Markdown ファイルのキーと etag を取得し、get() で指定キーの本文をテキストとして返す
  - R2 の list/get 動作をモックベースのテストで検証する
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 4. コマンドリポジトリの拡張
- [ ] 4.1 (P) ドメインインタフェースに upsert と slug ベース削除を追加
  - INoteCommandRepository に upsert メソッド (slug キーでの INSERT OR REPLACE) を追加する
  - INoteCommandRepository に deleteBySlug メソッド (slug 指定削除) を追加する
  - 既存のインタフェーステストを更新して新メソッドの型定義を検証する
  - _Requirements: 4.2, 5.2, 6.1_
  - _Contracts: INoteCommandRepository_

- [ ] 4.2 D1 実装に upsert と deleteBySlug を追加
  - D1 の SQLite UPSERT (INSERT ... ON CONFLICT(slug) DO UPDATE) を使い、slug をキーとした追加・更新を実装する
  - slug 指定での削除を実装する (存在しない場合はノーオペレーション)
  - 各操作のテストを追加する
  - _Requirements: 4.2, 4.3, 5.2, 6.1_

- [ ] 5. 記事再構築サービスの実装
- [ ] 5.1 突合ロジックの実装
  - R2 の一覧と D1 の全レコードを並列取得し、slug と etag を比較して追加・更新・削除・スキップの各対象を判定するロジックを実装する
  - slug の抽出はオブジェクトキーからファイル拡張子を除去して生成する
  - 全パターン (追加のみ、更新のみ、削除のみ、混在、変更なし) をモックベースのテストで検証する
  - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5.2 追加・更新処理の実装
  - 追加対象について R2 から本文を取得し、frontmatter パース関数でメタデータを抽出して Note エンティティを生成し、upsert で保存する
  - 更新対象についても同様に本文を再取得・再パースし、既存レコードのメタデータと etag を最新の値で更新する
  - slug, title, imageUrl, publishedOn, lastModifiedOn, etag が保存されることを検証する
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2_

- [ ] 5.3 削除処理と同期結果レポートの実装
  - 削除対象について slug ベースで D1 レコードを削除する
  - 同期処理の結果として追加件数 (added)、更新件数 (updated)、削除件数 (deleted) を返却する
  - 変更が一切ない場合に全件数が 0 となることを検証する
  - _Requirements: 6.1, 8.1, 8.2_

- [ ] 6. API エンドポイントの実装とルーティング統合
- [ ] 6.1 POST /api/v1/notes/refresh ハンドラの実装
  - Hono ルートとして POST /api/v1/notes/refresh を定義し、ハンドラ内で DI (D1 接続と NOTES_R2 バインディング) を行い NotesRefreshService を生成して実行する
  - 成功時は追加・更新・削除件数を含む JSON レスポンスを 200 で返す
  - エラー時はエラーメッセージを含む JSON レスポンスを 500 で返す
  - _Requirements: 7.1, 7.2, 7.3_
  - _Contracts: NotesRefreshHandler API_

- [ ] 6.2 バックエンドルーティングへの統合
  - バックエンドのメインルーター (getApp) に notes refresh ハンドラを登録し、エンドポイントにリクエストが到達することを確認する
  - ハンドラのテストで正常系と異常系のレスポンス形式を検証する
  - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2_
