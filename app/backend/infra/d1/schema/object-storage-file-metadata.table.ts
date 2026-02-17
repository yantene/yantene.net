import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { instant } from "./custom-types/temporal.custom-type";

export const objectStorageFileMetadata = sqliteTable(
  "object_storage_file_metadata",
  {
    id: text("id").notNull().primaryKey(),
    objectKey: text("object_key").notNull().unique(),
    size: integer("size").notNull(),
    contentType: text("content_type").notNull(),
    etag: text("etag").notNull(),
    createdAt: instant("created_at")
      .notNull()
      .default(sql`(unixepoch('subsec'))`),
    updatedAt: instant("updated_at")
      .notNull()
      .default(sql`(unixepoch('subsec'))`),
  },
);
