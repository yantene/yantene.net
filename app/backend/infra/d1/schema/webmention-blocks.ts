import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 出さない送信元のホスト。
 *
 * 承認制ではなくブロックリストを採っている (#191)。**登録したホストの下位ドメインも
 * 一緒に止まる**が、その判定はドメイン層 (isBlockedHost) が持つ。この表は並びを
 * 保存するだけで、意味づけはしない。
 *
 * 管理画面は設けない方針なので、足すのは `wrangler d1 execute` で行う。
 * reason は後から見たときに「なぜ止めたのか」を思い出すための覚え書き。
 */
export const webmentionBlocks = sqliteTable("webmention_blocks", {
  host: text("host").primaryKey(),
  reason: text("reason"),
  createdAt: integer("created_at").notNull(),
});
