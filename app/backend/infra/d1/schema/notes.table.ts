import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { instant } from "./custom-types/temporal.custom-type";

export const notes = sqliteTable("notes", {
  id: text("id").notNull().primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  etag: text("etag").notNull(),
  imageUrl: text("image_url").notNull(),
  createdAt: instant("created_at")
    .notNull()
    .default(sql`(unixepoch('subsec'))`),
  updatedAt: instant("updated_at")
    .notNull()
    .default(sql`(unixepoch('subsec'))`),
});
