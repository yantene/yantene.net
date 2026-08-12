import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { notes } from "./notes";

/**
 * 受信した Webmention。検証を通ったものだけが入る。
 *
 * - (note_id, source) で一意。Webmention は再送で更新される仕様なので、同じ送り元から
 *   何度届いても行は 1 つに保つ。
 * - author_name / content は保存の時点でタグを落としたテキストになっている
 *   (domain/webmention の VO が均す)。ただし `<` や `>` は**文字として**残りうるので
 *   (`&lt;script&gt;` を実体参照から戻したものなど)、表示は必ずエスケープされる経路
 *   (React の子要素) で出すこと。`dangerouslySetInnerHTML` に渡してはならない。
 * - published_at は送り元の記事の公開日時 (Unix 秒)。読めなければ NULL。
 * - received_at は初めて受け取った時刻、updated_at は最後に検証し直した時刻。
 *   再送で received_at を動かさないのは、表示の並びが送り手の都合で入れ替わらない
 *   ようにするため。
 * - note 削除時のカスケード用に FK を張るが、D1 は FK 強制が既定で無効なため、
 *   note 側の Command リポジトリでも明示的に掃除する (note_tags と同じ扱い)。
 */
export const webmentions = sqliteTable(
  "webmentions",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    /** 送り先のノートのスラグ。note_id を引き直さずに URL を組めるよう持たせる。 */
    target: text("target").notNull(),
    /** 送り元の記事の URL。 */
    source: text("source").notNull(),
    /** reply / like / repost / mention。 */
    type: text("type").notNull(),
    authorName: text("author_name"),
    authorUrl: text("author_url"),
    authorPhoto: text("author_photo"),
    content: text("content"),
    publishedAt: integer("published_at"),
    receivedAt: integer("received_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("webmentions_note_id_source_idx").on(
      table.noteId,
      table.source,
    ),
  ],
);
