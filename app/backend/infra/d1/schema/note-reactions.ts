import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { notes } from "./notes";

/**
 * ノートに付いたリアクションの数。絵文字ごとに 1 行を持つ。
 *
 * この表が持つのは「どの絵文字が何回押されたか」だけで、誰が押したかは残らない。
 * 押した本人が取り消し・差し替えできるようにするための「この人が何を押したか」は
 * 読み手のセッション (KV) 側にある (ADR 0011)。
 *
 * - (note_id, emoji) の複合主キーで、同じ絵文字の行が割れないようにする。
 * - note 削除時のカスケード用に FK を張るが、D1 は FK 強制が既定で無効なため、
 *   Command リポジトリ側でも明示的に掃除する (note_tags と同じ扱い)。
 * - 索引は張らない。読むのは常に 1 記事ぶんで、主キーの先頭が note_id なのでそれで引ける。
 */
export const noteReactions = sqliteTable(
  "note_reactions",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    /*
     * 押されている数。取り消しで減るので、閲覧数と違って単調ではない。
     * 0 の行は残す (消すと、取り消しのたびに行の出し入れが起きる)。
     */
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.noteId, table.emoji] })],
);
