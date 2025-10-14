import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const errorLogs = sqliteTable("error_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  level: text("level").notNull().default("error"),
  message: text("message").notNull(),
  stack: text("stack"),
  context: text("context"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
