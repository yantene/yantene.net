import { index, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { notes } from "./notes";

/**
 * 記事どうしの近さ。関連ノートはこの表を読んで並べる。
 *
 * **上位 N 件に切り詰めて保存しない。** refresh は変更のあった記事しか処理しないので、
 * 各記事の上位 N 件を確定した形で持つと、後から書いた記事が古い記事の関連ノートに
 * 永久に出てこない。ペアのまま置いて、読むときに ORDER BY で切る。
 *
 * **両方向を書く。** (a, b) と (b, a) の 2 行になり、記事数の 2 乗で増える。57 本で
 * 3,192 行、1,000 本で 999,000 行 (約 38 MB)。D1 の上限 (有料 10 GB / 無料 500 MB) に
 * 当たるのは数千本のあたりで、そこまで来たら上位 N 件に切る形へ移すことになる。
 * 片方向にして読むたびに OR で引く形は、索引が効かなくなるので採らない。
 */
export const noteSimilarities = sqliteTable(
  "note_similarities",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    otherNoteId: text("other_note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    similarity: real("similarity").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.noteId, table.otherNoteId] }),
    // 「この記事に近い順に 6 件」がこの索引だけで済む。
    index("note_similarities_note_id_similarity_idx").on(table.noteId, table.similarity),
  ],
);
