import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * ノートのメタデータインデックス。コンテンツ正本は Cloudflare Artifacts、
 * 本文 (MDAST) と画像は R2 にあり、この D1 テーブルは一覧・ルーティング用の
 * メタデータだけを保持する (ADR 0005)。
 *
 * - published_on / last_modified_on: フロントマター由来の日付。ISO 日付文字列
 *   ("YYYY-MM-DD") で保存し、辞書順ソート = 日付順ソートを利用する。
 * - created_at / updated_at: D1 行の作成・更新時刻 (Unix 秒)。コンテンツ日付とは別。
 */
export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  imageUrl: text("image_url"),
  // 連載 (シリーズ)。フロントマター由来。単発記事では null。
  // series: 表示名 / series_slug: URL 用 (表示名を slug 化) / series_order: 連載内の順序。
  series: text("series"),
  seriesSlug: text("series_slug"),
  seriesOrder: integer("series_order"),
  publishedOn: text("published_on").notNull(),
  lastModifiedOn: text("last_modified_on").notNull(),
  // コンテンツ正本のリビジョン識別子 (Markdown + アセットの合成ハッシュ)。
  // refresh の変更検出に使う。既存行への ADD COLUMN を安全にするため DEFAULT '' を持つ
  // (空ハッシュは次回 refresh で必ず不一致になり再処理される)。
  sourceHash: text("source_hash").notNull().default(""),
  /*
   * 読まれた回数と、そこから作る人気の目安。
   *
   * 読んだ人を特定できる値は持たない。ここにあるのは「何回読まれたか」だけで、
   * 誰がいつ読んだかは残らない。
   *
   * - view_count: 累計。減らない
   * - view_score: 時間とともに軽くなる重み付きの数。読み出すときに、最後に触った日
   *   からの経過ぶんを減衰させてから比べる (domain/note-view/view-ranking)
   * - view_scored_on: view_score を最後に触った日 (ISO 日付, UTC)。まだ読まれて
   *   いなければ null。減衰の起点になるので、score と必ず対で更新する
   */
  viewCount: integer("view_count").notNull().default(0),
  viewScore: real("view_score").notNull().default(0),
  viewScoredOn: text("view_scored_on"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
