import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 通知を 1 日に何通送ったか。通知の種類と日付ごとに 1 行を持つ。
 *
 * 上限を超えて送らないための数で、送った中身は残さない。
 *
 * - (channel, day) の複合主キー。channel は通知の種類 (`reaction-mail` など)、
 *   day は UTC の日付 (`2026-11-25`)
 * - **数えるのは upsert 1 手。** 読んでから書くと、同時に届いた要求がそろって
 *   上限の手前の数を読み、そろって送ってしまう
 * - 古い日付の行は消さない。1 日 1 行で、増え方は日数にしか比例しない
 */
export const notificationQuotas = sqliteTable(
  "notification_quotas",
  {
    channel: text("channel").notNull(),
    day: text("day").notNull(),
    sent: integer("sent").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.channel, table.day] })],
);
