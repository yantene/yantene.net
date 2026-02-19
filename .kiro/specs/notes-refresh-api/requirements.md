# Requirements Document

## Project Description (Input)

記事再構築 API (`POST /api/v1/notes/refresh`) の実装。R2 バケット (notes) に保存された Markdown ファイルと D1 データベース (notes テーブル) を同期するための API エンドポイント。処理フロー: 1) notes テーブルの slug と etag を全件取得、2) notes バケットから Markdown ファイル一覧を取得、3) 突合処理 — 追加(R2にあるがD1にない)、更新(etag不一致)、削除(D1にあるがR2にない)。R2 の Markdown ファイルからメタデータ(title, imageUrl, publishedOn, lastModifiedOn)をパースする必要がある。既存の SyncService (stored-object 用) と同様のパターンで実装する。既存の Note ドメインモデル、リポジトリ、インフラ層は必要に応じて修正・置き換え可能。GitHub Issue: https://github.com/yantene/yantene.net/issues/30

## Requirements

<!-- Will be generated in /kiro:spec-requirements phase -->
