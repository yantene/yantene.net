import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 書き手のプロフィール。**常に 1 行**で、主キーは固定値 (`PROFILE_ID`)。
 *
 * 長い自己紹介 (MDAST) と顔写真の実体は R2 にあり、この表が持つのは記事の末尾が毎回
 * 読むもの — 名前と短い自己紹介 — だけ (ADR 0041)。
 *
 * - source_hash: コンテンツリポジトリのリビジョン識別子 (Markdown + アセットの合成ハッシュ)。
 *   refresh の変更検出に使う。既定の空ハッシュは次回 refresh で必ず不一致になる
 * - created_at / updated_at: D1 行の作成・更新時刻 (Unix 秒)
 */
export const profile = sqliteTable("profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  /*
   * ⚠️ **読み書きしていない。次のリリースで落とす (#507)。**
   *
   * 生い立ちは名乗りの欄ではなく本文に書くことにした (#508)。列を残してあるのは
   * `avatar_url` と同じ理由で、列を消す migration が **Deploy より先に走る**ため。
   */
  dateOfBirth: text("date_of_birth"),
  birthplace: text("birthplace"),
  /*
   * ⚠️ **読み書きしていない。次のリリースで落とす (#507)。**
   *
   * 顔はサイトのアイコン 1 つに決まっていて、書き手が選ぶ欄ではなくなった。ここに
   * 残してあるのは、列を消す migration が **Deploy より先に走る**ため
   * (environments.md の「後方互換でない変更は…分ける」)。同じリリースで消すと、
   * その数十秒のあいだ旧コードが消えた列を読む。
   */
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

/**
 * 経歴。フロントマターに書いた順 (`position`) に出す。
 *
 * **章 (`chapter`) を各行が持つ。** 章ごとの表は作らない。読み出しは `position` 順の
 * 1 本の並びで、章に畳み直すのは出す側 (`toPublicHistory`)。行の形が
 * `profile_socials` と同じになるので、upsert の「消して入れ直す」もそのまま使える。
 *
 * - year: 起きた年 (西暦 4 桁)。月日は持たない
 * - url: 任意。あると `text` がその先へのリンクになる
 * - note: 任意。`text` の下に 1 行だけ添える補足
 */
export const profileHistory = sqliteTable(
  "profile_history",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => profile.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    chapter: text("chapter").notNull(),
    year: integer("year").notNull(),
    text: text("text").notNull(),
    url: text("url"),
    note: text("note"),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.position] })],
);
