# 実装計画

## タスク一覧

- [x] 1. (P) 依存関係の追加と環境設定
  - Drizzle ORM、Drizzle Kit、Temporal Polyfill をインストール
  - wrangler.jsonc に D1 バインディング設定を追加（development 環境と production 環境）
  - wrangler.jsonc に `nodejs_compat` フラグを追加
  - drizzle.config.ts を作成し、スキーマパスとマイグレーション出力パスを設定
  - package.json に npm scripts（db:generate, db:dev:migrate, db:dev:reset, db:prod:migrate, db:prod:reset）を追加
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 5.6_

- [x] 2. (P) ドメイン層の実装
- [x] 2.1 (P) 永続化状態インターフェースの定義
  - IPersisted インターフェースを定義（id: string, createdAt: Temporal.Instant, updatedAt: Temporal.Instant）
  - IUnpersisted インターフェースを定義（id: undefined, createdAt: undefined, updatedAt: undefined）
  - IEntity インターフェースを定義（equals メソッド）
  - _Requirements: 4.1, 4.3_

- [x] 2.2 Click エンティティの実装
  - Click クラスにジェネリクス `<P extends IPersisted | IUnpersisted>` を適用
  - create() メソッドで未永続化エンティティを生成（timestamp を受け取る）
  - reconstruct() メソッドでデータベースから取得したデータを永続化エンティティに変換
  - equals() メソッドで ID 比較を実装
  - toJSON() メソッドでプレーンオブジェクトに変換
  - _Requirements: 4.1, 4.3, 4.4_

- [x] 2.3 リポジトリインターフェースの定義
  - IClickCommandRepository インターフェースを定義
  - save(click: Click<IUnpersisted>): Promise<Click<IPersisted>> メソッドを宣言
  - count(): Promise<number> メソッドを宣言
  - _Requirements: 2.4, 2.5, 4.3_

- [x] 2.4 ユースケースの実装
  - IncrementClickUsecase クラスを実装
  - コンストラクタで IClickCommandRepository を DI パターンで受け取る
  - execute() メソッドで Click.create() を呼び出し、現在時刻の UNIX タイムスタンプを設定
  - リポジトリの save() メソッドでエンティティを保存
  - リポジトリの count() メソッドで総クリック数を取得
  - { count: number } 形式のオブジェクトを返す
  - _Requirements: 2.3, 2.4, 2.5, 2.6, 4.3_

- [x] 3. インフラ層の実装
- [x] 3.1 Temporal カスタム型の定義
  - instant カスタム型を定義（data: Temporal.Instant, driverData: number）
  - toDriver() メソッドで Temporal.Instant を SQLite REAL 値に変換（epochMilliseconds / 1000）
  - fromDriver() メソッドで SQLite REAL 値を Temporal.Instant に変換（\* 1000）
  - _Requirements: 1.1, 1.2, 4.1_

- [x] 3.2 データベーススキーマの定義
  - clicks テーブルを sqliteTable で定義
  - id カラム（TEXT, PRIMARY KEY, NOT NULL）
  - timestamp カラム（INTEGER, NOT NULL）
  - createdAt カラム（instant 型, NOT NULL, DEFAULT unixepoch('subsec')）
  - updatedAt カラム（instant 型, NOT NULL, DEFAULT unixepoch('subsec')）
  - schema/index.ts でエクスポート
  - _Requirements: 1.1, 1.2, 4.1, 4.3_

- [x] 3.3 マイグレーションファイルの生成と適用
  - pnpm run db:generate で Drizzle Kit がマイグレーションファイルを生成
  - pnpm run db:dev:migrate で Wrangler CLI がローカル D1 にマイグレーションを適用
  - clicks テーブルが正しく作成されることを確認
  - _Requirements: 1.3, 1.5, 5.2_

- [x] 3.4 リポジトリ実装の作成
  - ClickCommandRepository クラスで IClickCommandRepository インターフェースを実装
  - コンストラクタで DrizzleD1Database を受け取る
  - save() メソッドで crypto.randomUUID() で id を生成
  - drizzle().insert(clicks).values().returning().get() で挿入し、結果を取得
  - Click.reconstruct() で永続化エンティティを返す
  - count() メソッドで drizzle().select({ count: drizzleCount() }).from(clicks).get() を実行
  - 結果の count 値を返す（未定義の場合は 0）
  - _Requirements: 2.1, 2.4, 2.5, 4.3_

- [x] 4. ハンドラー層の実装
- [x] 4.1 共有型定義の作成
  - app/lib/types/counter.ts に CounterResponse 型を定義（{ count: number }）
  - _Requirements: 4.2, 4.6_

- [x] 4.2 Counter API ハンドラーの実装
  - app/backend/handlers/api/counter/index.ts に counterApp を作成
  - POST /increment エンドポイントを実装
  - c.env.D1 から D1 バインディングを取得し、drizzle() で Drizzle クライアントを初期化
  - ClickCommandRepository をインスタンス化
  - IncrementClickUsecase をインスタンス化し、リポジトリを注入
  - execute() メソッドを呼び出し、結果を取得
  - CounterResponse 型で c.json({ count: result.count }) を返す
  - エラー発生時は console.error でログ出力し、c.json({ error: "..." }, 500) を返す
  - _Requirements: 2.2, 2.3, 2.6, 2.7, 2.8, 6.1, 6.2, 6.5_

- [x] 4.3 バックエンドルーティングの統合
  - app/backend/index.ts の getApp() ファクトリ関数で .route("/api/counter", counterApp) を追加
  - _Requirements: 2.3_

- [x] 5. フロントエンド層の実装
- [x] 5.1 Counter ルートの作成
  - app/frontend/routes/counter.tsx を作成
  - meta 関数を実装（title: "Counter Demo", description: "Cloudflare D1 + Drizzle counter demo"）
  - _Requirements: 3.1_

- [x] 5.2 Counter UI とステート管理の実装
  - useState<number> でカウンター数値を管理（初期値 0）
  - useState<boolean> でローディング状態を管理（初期値 false）
  - useState<string | undefined> でエラーメッセージを管理（初期値 undefined）
  - handleIncrement 関数で fetch("/api/counter/increment", { method: "POST" }) を実行
  - ローディング状態を true に設定し、ボタンを無効化
  - API レスポンスを CounterResponse 型で取得し、setCount(data.count) で更新
  - エラー発生時は setErrorMessage でメッセージを設定
  - finally ブロックで setIsLoading(false) を実行
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9, 4.6, 6.4_

- [x] 5.3 Counter UI の TailwindCSS スタイリング
  - カウンター数値を大きなフォントサイズで表示（text-4xl）
  - カウントアップボタンを配置（rounded, bg-blue-500, hover:bg-blue-600, disabled:bg-gray-300）
  - ローディング状態に応じてボタンテキストを変更（"Loading..." / "Increment"）
  - エラーメッセージを赤色で表示（text-red-500）
  - レスポンシブデザインを適用（flex, items-center, justify-center）
  - _Requirements: 3.8_

- [x] 6. ドキュメントの更新
  - README.md に D1 Database Setup セクションを追加
  - ローカル開発環境のセットアップ手順を記載（pnpm install, db:generate, db:dev:migrate, dev）
  - マイグレーション失敗時のロールバック手順を記載（db:dev:reset）
  - 本番環境へのデプロイ手順を記載（Cloudflare ダッシュボードで D1 作成、database_id 更新、db:prod:migrate、deploy）
  - db:prod:reset の注意事項を記載（本番データベースの全テーブル削除のため、開発初期段階のみ推奨）
  - _Requirements: 1.5, 5.5, 6.6_

- [x] 7. 統合テストとエンドツーエンドテストの実装
- [x] 7.1 Click エンティティのユニットテスト
  - create() メソッドが未永続化エンティティを正しく生成することを確認
  - reconstruct() メソッドが永続化エンティティを正しく生成することを確認
  - equals() メソッドが ID 比較を正しく実行することを確認
  - toJSON() メソッドが正しいプレーンオブジェクトを返すことを確認
  - _Requirements: 4.5, 4.7_

- [x] 7.2 IncrementClickUsecase のユニットテスト
  - モックリポジトリを使用して、ユースケースが正しくエンティティを生成し、リポジトリを呼び出すことを確認
  - execute() メソッドが { count: number } 形式のオブジェクトを返すことを確認
  - _Requirements: 4.5, 4.7_

- [x] 7.3 ClickCommandRepository のユニットテスト
  - モック D1 バインディングを使用して、save() メソッドが clicks テーブルへの挿入と reconstruct() を正しく実行することを確認
  - count() メソッドが正しい総カウント数を返すことを確認
  - エラー発生時に例外をスローすることを確認
  - _Requirements: 4.5, 4.7_

- [x] 7.4 API エンドポイント統合テスト
  - /api/counter/increment に POST リクエストを送信し、正常なレスポンスが返却されることを確認
  - 複数回リクエストを送信し、カウンターが正しくインクリメントされることを確認
  - 不正な HTTP メソッドで呼び出した場合、405 エラーが返却されることを確認
  - _Requirements: 4.5, 4.7, 6.3_

- [x] 7.5 Counter ルートの E2E テスト
  - /counter ページにアクセスし、UI が正しく表示されることを確認
  - カウントアップボタンをクリックし、カウンターが更新されることを確認
  - ローディング状態が正しく表示されることを確認
  - API エラー時にエラーメッセージが表示されることを確認
  - _Requirements: 4.5, 4.7_

- [x] 8. 型チェックとコード品質の最終検証
  - pnpm run typecheck がエラーなく完了することを確認
  - pnpm run lint がエラーなく完了することを確認
  - すべてのファイルでインライン型インポート形式が使用されていることを確認
  - Boolean 変数の命名規則（is/has/should/can/will/did プレフィックス）が遵守されていることを確認
  - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7_
