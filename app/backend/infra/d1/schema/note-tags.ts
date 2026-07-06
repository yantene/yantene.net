import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { notes } from "./notes";

/**
 * ノートとタグの関連 (正規化)。1 ノートが複数タグを持つ。
 *
 * - (note_id, tag) の複合主キーで同一タグの重複を防ぐ。
 * - note 削除時のカスケード用に FK を張るが、D1 は FK 強制が既定で無効なため、
 *   Command リポジトリ側でも明示的に note_tags を掃除する。
 * - tag での絞り込み・集計 (タグ索引) のため tag に index を張る。
 */
export const noteTags = sqliteTable(
  "note_tags",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.noteId, table.tag] }),
    index("note_tags_tag_idx").on(table.tag),
  ],
);
