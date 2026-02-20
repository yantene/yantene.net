# Implementation Plan

- [ ] 1. 依存パッケージの追加
  - mdast ツリー走査に必要な `unist-util-visit` を dependencies に追加する
  - mdast の型定義 `@types/mdast` を devDependencies に追加する
  - パッケージインストール後、既存テストとビルドが正常に通ることを確認する
  - _Requirements: 2.3, 3.3_

- [ ] 2. ドメイン層のエラークラスとレスポンス型の追加
- [ ] 2.1 (P) ドメインエラークラスの追加
  - 記事が DB に存在しない場合を表す `NoteNotFoundError` を既存のエラーファイルに追加する
  - Markdown ファイルがストレージに存在しない場合を表す `MarkdownNotFoundError` を追加する
  - 各エラークラスは slug を受け取り、明確なメッセージを持つ
  - TDD: 各エラークラスのインスタンス化とプロパティを検証するテストを先に書く
  - _Requirements: 5.1, 5.2_

- [ ] 2.2 (P) 記事詳細レスポンス型の定義
  - 記事詳細 API のレスポンス構造を表す型を共有型ファイルに追加する
  - id, title, slug, imageUrl, publishedOn, lastModifiedOn のメタデータフィールドと、mdast Root ノードを含む content フィールドを定義する
  - 日付フィールドは ISO 8601 形式の文字列型とする
  - _Requirements: 1.2, 8.1, 8.2, 8.3_

- [ ] 3. Markdown から mdast への変換機能
- [ ] 3.1 相対画像パスをアセット配信 API の URL に解決する関数を実装する
  - mdast ツリー全体を走査し、image ノードを検出する
  - 相対パス (http:// または https:// で始まらない URL) をアセット配信 API のパス (`/api/v1/notes/{slug}/assets/{path}`) に変換する
  - 絶対 URL はそのまま保持する
  - 元のツリーを変更せず、新しいツリーを返す純粋関数として実装する
  - TDD: 相対パス変換、絶対 URL 保持、image ノードなしのパススルー、ネストされた image ノードの走査を検証するテストを先に書く
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3.2 Markdown 文字列を mdast Root ノードに変換する関数を実装する
  - unified + remark-parse + remark-frontmatter パイプラインで Markdown をパースする
  - パース後のツリーから frontmatter (YAML ノード) を除外する
  - 画像パス解決関数を呼び出して相対画像パスをアセット API URL に変換する
  - 純粋関数として設計し、slug を受け取って画像パスの解決に使用する
  - TDD: frontmatter 除去、mdast Root ノード生成、空 Markdown の処理、画像パス解決の統合を検証するテストを先に書く
  - 3.1 の画像パス解決関数に依存するため、3.1 完了後に実装する
  - _Requirements: 2.1, 2.2, 2.3, 8.2_

- [ ] 4. 記事詳細取得ユースケースの実装
  - slug を受け取り、クエリリポジトリからメタデータ、Markdown ストレージから本文を取得する
  - ReadableStream を文字列に変換し、mdast 変換関数を呼び出す
  - メタデータと mdast を組み合わせた結果オブジェクトを返す
  - 日付フィールドは ISO 8601 形式の文字列に変換する
  - 記事が DB に存在しない場合は NoteNotFoundError をスローする
  - Markdown がストレージに存在しない場合は MarkdownNotFoundError をスローする
  - TDD: 正常系のレスポンス構造検証、NoteNotFoundError と MarkdownNotFoundError のスロー検証をモックを使ったテストで先に書く
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 5.1, 5.2, 8.1, 8.3, 9.4_

- [ ] 5. ハンドラ層の実装と既存ルートグループへの統合
- [ ] 5.1 記事詳細ハンドラの実装
  - 既存の notesApp ルートグループに `GET /:noteSlug` エンドポイントを追加する
  - パスパラメータの slug を NoteSlug で検証し、不正な場合は 400 ProblemDetails を返す
  - ユースケースを呼び出し、結果を JSON レスポンスとして返す
  - ドメイン例外 (NoteNotFoundError, MarkdownNotFoundError) を 404 ProblemDetails に変換する
  - 内部エラーは console.error でログ出力し、500 ProblemDetails を返す
  - ルート定義順序は既存の `/` と `/refresh` の後に配置し、競合を防ぐ
  - TDD: 正常レスポンス、400 (不正 slug)、404 (記事なし / Markdown なし)、500 (内部エラー) のケースをテストで先に書く
  - _Requirements: 1.1, 1.3, 1.4, 5.1, 5.2, 5.3, 7.1, 7.2, 7.3, 9.1, 9.3_

- [ ] 5.2 アセット配信ハンドラの実装
  - 既存の notesApp ルートグループに `GET /:noteSlug/assets/*` エンドポイントを追加する
  - パスパラメータの slug を NoteSlug で検証し、不正な場合は 400 ProblemDetails を返す
  - slug とアセットパスを連結して ObjectKey を構築し、IAssetStorage から取得する
  - アセットが見つからない場合は 404 ProblemDetails を返す
  - レスポンスにバイナリストリーム、Content-Type、ETag ヘッダーを設定する
  - 内部エラーは console.error でログ出力し、500 ProblemDetails を返す
  - TDD: バイナリストリーム返却、Content-Type 設定、ETag ヘッダー、404 (アセットなし)、400 (不正 slug)、500 (内部エラー) のケースをテストで先に書く
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 7.4, 7.5, 9.2, 9.3_

- [ ] 6. 統合検証
  - 既存の `GET /api/v1/notes` (一覧) エンドポイントが引き続き正常動作することを確認する
  - 既存の `POST /api/v1/notes/refresh` (再構築) エンドポイントが引き続き正常動作することを確認する
  - 記事詳細 API とアセット配信 API のルートが互いに干渉しないことを確認する
  - 全エラーレスポンスの Content-Type が `application/problem+json` であることを確認する
  - 型チェック、リント、既存テストを含む全品質ゲートを通過させる
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 7.3, 7.5_
