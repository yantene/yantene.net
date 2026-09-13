import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 管理者が登録した passkey (ADR 0036)。
 *
 * **この表が管理者の全体。** ここに行が 1 つも無ければ誰もログインできず、
 * 登録用の secret を示した要求だけが最初の 1 本を入れられる。端末をすべて失ったときは
 * この表を空にして登録からやり直す。
 *
 * 秘密鍵は認証器の中にあり、ここには無い。持っているのは公開鍵だけなので、
 * この表が漏れてもなりすましには使えない。
 */
export const adminCredentials = sqliteTable("admin_credentials", {
  /** 認証器が決めた credential id (base64url)。 */
  id: text("id").primaryKey(),
  /** COSE_Key の CBOR を base64url にしたもの。検証のたびに取り込み直す。 */
  publicKey: text("public_key").notNull(),
  /** "ES256" か "RS256"。登録を求めるときに申告する 2 つだけ。 */
  algorithm: text("algorithm").notNull(),
  /**
   * 認証器が数えている使用回数。
   *
   * 多くの passkey は 0 のまま動かさない (同期される鍵は複数の端末に居るため)。
   * 複製の検知には使えないので、進んでいれば記録するだけに留める。
   */
  signCount: integer("sign_count").notNull().default(0),
  /** 人が見分けるための名前。「MacBook の Touch ID」など。 */
  label: text("label").notNull(),
  /** 鍵が同期されているか。端末に閉じた鍵と見分けるために持つ。 */
  backedUp: integer("backed_up", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  /** 最後にこの鍵でログインした時刻 (Unix 秒)。一度も使っていなければ NULL。 */
  lastUsedAt: integer("last_used_at"),
});
