import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * 書き手のプロフィール。**行は 1 つだけ**で、コンテンツリポジトリの `profile.md` に対応する
 * (ADR 0041)。本文 (経歴と好きなもの) の MDAST は R2 にあり、ここには持たない。
 *
 * - date_of_birth: フロントマター由来の生年月日。ISO 日付文字列 ("YYYY-MM-DD")
 * - socials: 出ていく先の配列を JSON 文字列で持つ。別表にしないのは、数件しか無く、
 *   引くのが `/about` の 1 か所だけで、検索も絞り込みもしないため
 * - source_hash: コンテンツリポジトリのリビジョン識別子。refresh の変更検出に使う。
 *   既定は空ハッシュで、これは次回 refresh で必ず不一致になり再処理される
 *
 * **作成・更新時刻の列は置かない。** 読む側がどこにも無いので、置くと refresh に
 * 時計を渡すためだけの配線が増える。いつ同期したかは refresh の応答に出る。
 */
export const profile = sqliteTable(
  "profile",
  {
    /*
     * 1 に固定する。CHECK を置くのは、2 行目を作れてしまう作りだと「どちらが本物か」を
     * 読む側が決めることになるため。行が 1 つしか無いことを DB に言わせておけば、
     * 読み取りは常に「在るか無いか」で済む。
     */
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    dateOfBirth: text("date_of_birth").notNull(),
    birthplace: text("birthplace"),
    tagline: text("tagline").notNull(),
    socials: text("socials").notNull(),
    sourceHash: text("source_hash").notNull().default(""),
  },
  (table) => [check("profile_single_row", sql`${table.id} = 1`)],
);
