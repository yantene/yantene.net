# Requirements Document

## Project Description (Input)

記事一覧 API (`GET /api/v1/notes`) の実装。D1 データベース (notes テーブル) に保存された記事データをページネーション付きで一覧として取得するための API エンドポイント。既存の Note ドメインモデルを活用し、記事の公開日降順でソートされた一覧を JSON レスポンスとして返却する。ページネーションはカーソルベースまたはオフセットベースで実装し、クエリパラメータでページサイズとページ位置を指定可能とする。既存の notes-refresh-api (POST /api/v1/notes/refresh) と同じ Hono ルートグループに追加する。GitHub Issue: https://github.com/yantene/yantene.net/issues/31

## Requirements

<!-- Will be generated in /kiro:spec-requirements phase -->
