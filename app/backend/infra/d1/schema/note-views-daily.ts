import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { notes } from "./notes";

/**
 * ノートが読まれた回数の日次集計。
 *
 * 1 アクセスにつき 1 行を残すのではなく、日付ごとに数え上げた形で持つ。読んだ人を
 * 特定できる値 (IP・UA・識別子) は一切保存しない。ここにあるのは「どの記事が、いつ、
 * 何回読まれたか」だけで、誰が読んだかは残らない。
 *
 * - viewed_on: 集計日。ISO 日付文字列 ("YYYY-MM-DD", UTC) で保存する。
 * - (note_id, viewed_on) の複合主キーで、同じ日は 1 行に加算していく。
 * - 集計は日付の範囲で絞るため viewed_on に index を張る。
 * - note 削除時のカスケード用に FK を張るが、D1 は FK 強制が既定で無効なため、
 *   消し込みが要るなら Command リポジトリ側でも明示的に掃除すること。
 */
export const noteViewsDaily = sqliteTable(
  "note_views_daily",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    viewedOn: text("viewed_on").notNull(),
    viewCount: integer("view_count").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.noteId, table.viewedOn] }),
    index("note_views_daily_viewed_on_idx").on(table.viewedOn),
  ],
);
