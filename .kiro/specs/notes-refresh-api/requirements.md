# Requirements Document

## Project Description (Input)

記事再構築 API (`POST /api/v1/notes/refresh`) の実装。R2 バケット (notes) に保存された Markdown ファイルと D1 データベース (notes テーブル) を同期するための API エンドポイント。処理フロー: 1) notes テーブルの slug と etag を全件取得、2) notes バケットから Markdown ファイル一覧を取得、3) 突合処理 — 追加(R2にあるがD1にない)、更新(etag不一致)、削除(D1にあるがR2にない)。R2 の Markdown ファイルからメタデータ(title, imageUrl, publishedOn, lastModifiedOn)をパースする必要がある。既存の SyncService (stored-object 用) と同様のパターンで実装する。既存の Note ドメインモデル、リポジトリ、インフラ層は必要に応じて修正・置き換え可能。GitHub Issue: https://github.com/yantene/yantene.net/issues/30

## Introduction

本ドキュメントは、記事再構築 API (`POST /api/v1/notes/refresh`) の要件を定義する。このAPIは、R2 バケット (notes) に保存された Markdown ファイル群を正とし、D1 データベース (notes テーブル) との同期を行うエンドポイントである。既存の SyncService (stored-object 用) と同様の突合パターンに基づき、追加・更新・削除の3操作を実行する。

## Requirements

### Requirement 1: R2 バケットからの記事一覧取得

**Objective:** As a システム管理者, I want R2 バケット (notes) から Markdown ファイルの一覧を取得できること, so that 同期処理の比較元データとして利用できる

#### Acceptance Criteria

1. When 記事再構築処理が開始された場合, the Notes Refresh Service shall R2 バケット (notes) から全 Markdown ファイルの一覧を取得する
2. The Notes Refresh Service shall 各 Markdown ファイルのオブジェクトキーと etag を一覧として返す
3. When R2 バケットが空の場合, the Notes Refresh Service shall 空の一覧を返す

### Requirement 2: Markdown ファイルからのメタデータパース

**Objective:** As a システム管理者, I want R2 上の Markdown ファイルから記事メタデータ (title, imageUrl, publishedOn, lastModifiedOn) をパースできること, so that D1 の notes テーブルに正確なメタデータを保存できる

#### Acceptance Criteria

1. When Markdown ファイルの内容を取得した場合, the Notes Refresh Service shall YAML frontmatter からメタデータ (title, imageUrl, publishedOn, lastModifiedOn) をパースする
2. The Notes Refresh Service shall Markdown ファイル名 (拡張子を除く) を slug として使用する
3. If メタデータのパースに失敗した場合, the Notes Refresh Service shall パースエラーとして該当ファイルの情報を含むエラーを発生させる
4. If 必須メタデータ (title, imageUrl, publishedOn, lastModifiedOn) のいずれかが欠落している場合, the Notes Refresh Service shall バリデーションエラーを発生させる

### Requirement 3: D1 データベースとの突合処理

**Objective:** As a システム管理者, I want R2 バケットと D1 データベースの記事データを突合して差分を検出できること, so that 正確な追加・更新・削除対象を特定できる

#### Acceptance Criteria

1. When 同期処理が実行された場合, the Notes Refresh Service shall D1 の notes テーブルから全レコードの slug と etag を取得する
2. When R2 に存在するが D1 に存在しない slug がある場合, the Notes Refresh Service shall 該当ファイルを追加対象として検出する
3. When R2 と D1 の両方に存在する slug で etag が一致しない場合, the Notes Refresh Service shall 該当ファイルを更新対象として検出する
4. When D1 に存在するが R2 に存在しない slug がある場合, the Notes Refresh Service shall 該当レコードを削除対象として検出する
5. When R2 と D1 の両方に存在する slug で etag が一致する場合, the Notes Refresh Service shall 該当レコードを変更なしとしてスキップする

### Requirement 4: 追加処理

**Objective:** As a システム管理者, I want R2 に新規追加された Markdown ファイルを D1 の notes テーブルに登録できること, so that 新しい記事がデータベースに反映される

#### Acceptance Criteria

1. When 追加対象のファイルが検出された場合, the Notes Refresh Service shall R2 から該当 Markdown ファイルの内容を取得してメタデータをパースする
2. When メタデータのパースが成功した場合, the Notes Refresh Service shall パースしたメタデータを使用して Note エンティティを生成し D1 に保存する
3. The Notes Refresh Service shall 保存する Note に slug, title, imageUrl, publishedOn, lastModifiedOn, etag を含める

### Requirement 5: 更新処理

**Objective:** As a システム管理者, I want R2 上で更新された Markdown ファイルの内容を D1 の notes テーブルに反映できること, so that 記事の最新状態がデータベースに保持される

#### Acceptance Criteria

1. When 更新対象のファイルが検出された場合, the Notes Refresh Service shall R2 から該当 Markdown ファイルの内容を取得してメタデータを再パースする
2. When メタデータの再パースが成功した場合, the Notes Refresh Service shall 既存レコードのメタデータと etag を最新の値で更新する

### Requirement 6: 削除処理

**Objective:** As a システム管理者, I want R2 から削除された Markdown ファイルに対応する D1 レコードを削除できること, so that 存在しない記事がデータベースに残らない

#### Acceptance Criteria

1. When 削除対象のレコードが検出された場合, the Notes Refresh Service shall D1 の notes テーブルから該当レコードを削除する

### Requirement 7: API エンドポイント

**Objective:** As a システム管理者, I want HTTP API エンドポイント (`POST /api/v1/notes/refresh`) を通じて記事の再構築を実行できること, so that 任意のタイミングで記事の同期を実行できる

#### Acceptance Criteria

1. When `POST /api/v1/notes/refresh` リクエストを受信した場合, the API shall 記事再構築処理を実行する
2. When 同期処理が正常に完了した場合, the API shall 追加件数、更新件数、削除件数を含むレスポンスを返す
3. If 同期処理中にエラーが発生した場合, the API shall エラーメッセージを含むレスポンスをステータスコード 500 で返す

### Requirement 8: 同期結果レポート

**Objective:** As a システム管理者, I want 同期処理の結果 (追加・更新・削除の件数) を確認できること, so that 同期処理が期待通りに実行されたかを把握できる

#### Acceptance Criteria

1. The Notes Refresh Service shall 同期処理の結果として追加件数 (added)、更新件数 (updated)、削除件数 (deleted) を返す
2. When 変更が一切ない場合, the Notes Refresh Service shall 全ての件数を 0 として返す
