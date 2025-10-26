import { Temporal } from "@js-temporal/polyfill";
import { sql } from "drizzle-orm";
import { customType, sqliteTable, text } from "drizzle-orm/sqlite-core";

const instant = customType<{
  data: Temporal.Instant;
  driverData: number;
}>({
  dataType() {
    return "real";
  },
  toDriver(value: Temporal.Instant): number {
    // ミリ秒を秒単位の小数に変換（SQLite の unixepoch('subsec') 形式）
    return value.epochMilliseconds / 1000;
  },
  fromDriver(value: number): Temporal.Instant {
    // SQLite の unixepoch('subsec') は秒単位の小数として返される
    const milliseconds = Math.floor(value * 1000);
    return Temporal.Instant.fromEpochMilliseconds(milliseconds);
  },
});

export const errorLogs = sqliteTable("error_logs", {
  id: text("id").notNull().primaryKey(),
  level: text("level").notNull().default("error"),
  message: text("message").notNull(),
  stack: text("stack"),
  context: text("context"),
  createdAt: instant("created_at")
    .notNull()
    .default(sql`(unixepoch('subsec'))`),
  updatedAt: instant("updated_at")
    .notNull()
    .default(sql`(unixepoch('subsec'))`),
});
