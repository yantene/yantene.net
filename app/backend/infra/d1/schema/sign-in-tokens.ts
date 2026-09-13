import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 送ったマジックリンク 1 本ぶん (ADR 0039)。
 *
 * **KV ではなく D1 に置く。** 使い捨てであることが守りの一部なので、「引き当てる」と
 * 「消す」を 1 手 (`DELETE ... RETURNING`) で済ませたい。KV では読んでから消す
 * 2 往復になり、同じリンクを同時に 2 回踏まれると両方が通る。加えて KV の削除は
 * colo をまたいで伝わるまで時間がかかるので、消したはずのリンクを別の colo が
 * 見つけられてしまう。
 *
 * 期限切れの行は次に発行するときにまとめて掃除する (KV と違い自動では消えない)。
 */
export const signInTokens = sqliteTable(
  "sign_in_tokens",
  {
    /**
     * トークンを SHA-256 に通した値 (base64url)。
     *
     * **生の値は置かない。** ここが漏れてもログインはできない。元が 256 bit の
     * 乱数なので、合言葉のような伸長は要らない。
     */
    tokenHash: text("token_hash").primaryKey(),
    /** 送った先。使い切ったときにこれがそのまま身元になる。 */
    email: text("email").notNull(),
    /** リンクを頼んだブラウザ。踏んだのが同じブラウザなら確認を飛ばす。 */
    requestId: text("request_id").notNull(),
    /** 期限 (Unix 秒)。これを過ぎた行は無効で、掃除の対象。 */
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    // 受信箱を埋めさせないための「生きている本数」を数える索引。
    index("sign_in_tokens_email_idx").on(table.email),
    // 掃除は「期限を過ぎた行を全部消す」なので、この索引で足りる。
    index("sign_in_tokens_expires_at_idx").on(table.expiresAt),
  ],
);
