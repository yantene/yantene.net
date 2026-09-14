import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 書き手のプロフィール。**常に 1 行**で、主キーは固定値 (`PROFILE_ID`)。
 *
 * 長い自己紹介 (MDAST) と顔写真の実体は R2 にあり、この表が持つのは記事の末尾が毎回
 * 読むもの — 名前・短い自己紹介・顔写真の URL — と、`/about` に出す生い立ち (ADR 0041)。
 *
 * - date_of_birth: 生年月日。ISO 日付文字列 ("YYYY-MM-DD")。書いていなければ NULL
 * - birthplace: 出身地。書いていなければ NULL
 * - source_hash: コンテンツリポジトリのリビジョン識別子 (Markdown + アセットの合成ハッシュ)。
 *   refresh の変更検出に使う。既定の空ハッシュは次回 refresh で必ず不一致になる
 * - created_at / updated_at: D1 行の作成・更新時刻 (Unix 秒)
 */
export const profile = sqliteTable("profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  dateOfBirth: text("date_of_birth"),
  birthplace: text("birthplace"),
  avatarUrl: text("avatar_url"),
  sourceHash: text("source_hash").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * 出ていく先。フロントマターに書いた順 (`position`) に出す。
 *
 * `platform` はアイコンを引くための種類の名前で、一覧は `app/lib/social-platforms.ts`。
 * `is_me` は `rel="me"` を出すかどうか (相手側からの相互リンクがある先にだけ立てる)。
 */
export const profileSocials = sqliteTable(
  "profile_socials",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => profile.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    platform: text("platform").notNull(),
    url: text("url").notNull(),
    isMe: integer("is_me", { mode: "boolean" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.position] })],
);
