import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 本文に貼られた URL から作るリンクカードのメタデータ。
 *
 * 記事ではなく **URL** に紐づける。同じリンクを複数の記事から張っても取得を 1 回で
 * 済ませたいため。どの記事に出るかは、その記事の MDAST を見れば分かる。
 *
 * - id: URL の SHA-256 (先頭 128 bit を 16 進で)。画像の配信パス
 *   (`/api/v1/link-cards/<id>/image`) と R2 のキーに使う。
 * - url: 本文に書かれたままの文字列。正規化しない (描画側が同じ文字列で引くため)。
 * - title: **NULL は「取得できなかった」を表す。** 行を作らずにおくと、落ちている相手を
 *   refresh のたびに叩き直すことになる。失敗も期限付きで覚えておく。
 * - has_image / has_favicon: 画像の実体は R2 にあるので、ここでは有無だけを持つ。
 * - fetched_at: 最後に取りに行った時刻 (Unix 秒)。期限切れの判定に使う。
 */
export const linkCards = sqliteTable(
  "link_cards",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull().unique(),
    title: text("title"),
    description: text("description"),
    siteName: text("site_name"),
    hasImage: integer("has_image").notNull().default(0),
    hasFavicon: integer("has_favicon").notNull().default(0),
    fetchedAt: integer("fetched_at").notNull(),
  },
  // 期限切れの洗い替えは「古い順に数件」を引くだけなので、この索引で足りる。
  (table) => [index("link_cards_fetched_at_idx").on(table.fetchedAt)],
);
