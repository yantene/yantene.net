import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 発行した WebAuthn のチャレンジ 1 回ぶん (ADR 0036)。
 *
 * **KV ではなく D1 に置く。** 使い捨てであることが守りの一部なので、
 * 「引き当てる」と「消す」を 1 手 (`DELETE ... RETURNING`) で済ませたい。KV では
 * 読んでから消す 2 往復になり、同じ応答を同時に 2 回送られると両方が通る。加えて
 * KV の削除は colo をまたいで伝わるまで時間がかかるので、消したはずのチャレンジを
 * 別の colo が見つけられてしまう。
 *
 * 期限切れの行は次に発行するときにまとめて掃除する (KV と違い自動では消えない)。
 */
export const passkeyCeremonies = sqliteTable(
  "passkey_ceremonies",
  {
    /** チャレンジそのもの (base64url)。追加の識別子は配らない。 */
    challenge: text("challenge").primaryKey(),
    /** "registration" か "authentication"。儀式の取り違えを弾くために持つ。 */
    purpose: text("purpose").notNull(),
    /** 期限 (Unix 秒)。これを過ぎた行は無効で、掃除の対象。 */
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    // 掃除は「期限を過ぎた行を全部消す」なので、この索引で足りる。
    index("passkey_ceremonies_expires_at_idx").on(table.expiresAt),
  ],
);
