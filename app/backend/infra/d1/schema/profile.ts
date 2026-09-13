import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 書き手のプロフィール。**常に 1 行**で、主キーは固定値 (`PROFILE_ID`)。
 *
 * 長い自己紹介 (MDAST) と顔写真の実体は R2 にあり、この表が持つのは記事の末尾が毎回
 * 読むもの — 名前・短い自己紹介・顔写真の URL — だけ (ADR 0041)。
 *
 * - source_hash: コンテンツリポジトリのリビジョン識別子 (Markdown + アセットの合成ハッシュ)。
 *   refresh の変更検出に使う。既定の空ハッシュは次回 refresh で必ず不一致になる
 * - created_at / updated_at: D1 行の作成・更新時刻 (Unix 秒)
 */
export const profile = sqliteTable("profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
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
 * ライフイベント。`/about` のタイムラインに並ぶ。
 *
 * - occurred_on: 並べ替えのための正規化キー ("YYYY-MM-DD")。粒度の足りない桁は 01 で埋める
 * - precision: 書かれた細かさ ("day" / "month" / "year")。表示はこれで出し分け、
 *   `<time dateTime>` には埋める前の値を入れる
 * - position: 保存時に振る並び (日付の古い順。同じ日付なら書いた順)
 * - kind: 出来事の種類。年別アーカイブ (#414) が `birth` / `school-entry` /
 *   `employment` を拾う。閉じた集合にはしない
 */
export const profileLifeEvents = sqliteTable(
  "profile_life_events",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => profile.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    occurredOn: text("occurred_on").notNull(),
    precision: text("precision").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.position] }),
    // 年別アーカイブ (#414) が「その年より前の節目」を引くための索引。
    index("profile_life_events_occurred_on_idx").on(table.occurredOn),
  ],
);
