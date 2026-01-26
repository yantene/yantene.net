import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { instant } from "./custom-types/temporal.custom-type";

export const clicks = sqliteTable("clicks", {
  id: text("id").notNull().primaryKey(),
  timestamp: integer("timestamp").notNull(),
  createdAt: instant("created_at")
    .notNull()
    .default(sql`(unixepoch('subsec'))`),
  updatedAt: instant("updated_at")
    .notNull()
    .default(sql`(unixepoch('subsec'))`),
});
