import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 作ったもののメタデータインデックス。原文は git のコンテンツリポジトリに、
 * 詳しい説明 (MDAST) と画像は R2 にあり、この表が持つのは `/about` と `/works` が
 * 本文を読まずに並べるためのものだけ (ADR 0042)。
 *
 * - position: 並び順。書き手がフロントマターに書いた数をそのまま入れる。日付では
 *   並べない (作った順に並べると年表になる)
 * - url: 作品そのものの在り処。外に出していない作品もあるので NULL を取る
 * - source_hash: コンテンツリポジトリのリビジョン識別子 (Markdown + アセットの合成
 *   ハッシュ)。refresh の変更検出に使う。既定の空ハッシュは次回 refresh で必ず
 *   不一致になる (書き損じた行が「同じ内容」として素通りしない)
 * - created_at / updated_at: D1 行の作成・更新時刻 (Unix 秒)
 */
export const works = sqliteTable(
  "works",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    url: text("url"),
    position: integer("position").notNull(),
    sourceHash: text("source_hash").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  // 一覧は常にこの順で引く。件数は少ないが、並びが索引に載っていれば
  // 「どの順で出るのか」がスキーマから読める。
  (table) => [index("works_position_idx").on(table.position)],
);
