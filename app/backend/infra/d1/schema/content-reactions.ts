import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * コンテンツに付いたリアクションの数。絵文字ごとに 1 行を持つ。種別をまたいで 1 つの
 * 表に持つ (ADR 0051)。
 *
 * この表が持つのは「どの絵文字が何回押されたか」だけで、誰が押したかは残らない。
 * 押した本人が取り消し・差し替えできるようにするための「この人が何を押したか」は
 * 読み手のセッション (KV) 側にある (ADR 0011)。
 *
 * - (kind, content_id, emoji) の複合主キーで、同じ絵文字の行が割れないようにする。
 *   content_id は種別ごとの表 (記事なら articles.id) を指す
 * - **FK は張らない。** 指す先の表が種別で変わるので張れない。指す先を消すときは
 *   Command リポジトリが明示的に掃除する
 * - 索引は張らない。読むのは常にコンテンツ 1 つぶんで、主キーの先頭 2 列で引ける
 */
export const contentReactions = sqliteTable(
  "content_reactions",
  {
    kind: text("kind").notNull(),
    contentId: text("content_id").notNull(),
    emoji: text("emoji").notNull(),
    /*
     * 押されている数。取り消しで減るので、閲覧数と違って単調ではない。
     * 0 の行は残す (消すと、取り消しのたびに行の出し入れが起きる)。
     */
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.kind, table.contentId, table.emoji] })],
);
