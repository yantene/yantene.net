import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { instant, plainDate } from "./custom-types/temporal.custom-type";

export const notes = sqliteTable("notes", {
  id: text("id").notNull().primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  etag: text("etag").notNull(),
  imageUrl: text("image_url").notNull(),
  summary: text("summary").notNull().default(""),
  publishedOn: plainDate("published_on").notNull(),
  lastModifiedOn: plainDate("last_modified_on").notNull(),
  createdAt: instant("created_at")
    .notNull()
    .default(sql`(unixepoch('subsec'))`),
  updatedAt: instant("updated_at")
    .notNull()
    .default(sql`(unixepoch('subsec'))`),
});
