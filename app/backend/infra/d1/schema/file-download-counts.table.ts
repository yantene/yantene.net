import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { objectStorageFileMetadata } from "./object-storage-file-metadata.table";

export const fileDownloadCounts = sqliteTable("file_download_counts", {
  objectKey: text("object_key")
    .notNull()
    .primaryKey()
    .references(() => objectStorageFileMetadata.objectKey),
  count: integer("count").notNull().default(0),
});
