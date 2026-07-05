import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  publishedOn: text("published_on").notNull(),
  lastModifiedOn: text("last_modified_on").notNull(),
  // コンテンツ正本のリビジョン識別子 (Markdown + アセットの合成ハッシュ)。
  // refresh の変更検出に使う。既存行への ADD COLUMN を安全にするため DEFAULT '' を持つ
  // (空ハッシュは次回 refresh で必ず不一致になり再処理される)。
  sourceHash: text("source_hash").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
