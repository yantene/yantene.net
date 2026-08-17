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
 * - image_missed: **og:image はあるのに写せなかった**ことを表す。has_image と 2 列で
 *   絵の状態 (写した / 無い / 取り逃した) を持つ。取り逃したカードは短い期限で
 *   取り直すので、「絵を持たない相手」と分けて覚えておく必要がある。
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
    imageMissed: integer("image_missed").notNull().default(0),
    hasFavicon: integer("has_favicon").notNull().default(0),
    /*
     * 続いている失敗が始まった時刻 (Unix 秒)。**NULL は「直近の取得は成功した」。**
     *
     * 「いま出せる中身」と「直近の取得結果」は別のことで、title だけでは表せない。
     * 分けずにいた頃は、相手が一瞬落ちただけで題も説明も NULL に上書きされ、記事の
     * カードが素のリンクへ落ちていた (#323)。
     *
     * 真偽値ではなく時刻で持つのは、**持ちこたえる上限を測るため**。失敗が続く間この列は
     * 動かさず、fetched_at だけが進む。両方進めると上限にいつまでも届かない。
     *
     * title が NULL の行では常に NULL になる (持ちこたえる中身が無い)。
     */
    fetchFailedSince: integer("fetch_failed_since"),
    fetchedAt: integer("fetched_at").notNull(),
  },
  // 期限切れの洗い替えは「古い順に数件」を引くだけなので、この索引で足りる。
  (table) => [index("link_cards_fetched_at_idx").on(table.fetchedAt)],
);
