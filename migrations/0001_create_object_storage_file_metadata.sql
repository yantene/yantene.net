CREATE TABLE `object_storage_file_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`size` integer NOT NULL,
	`content_type` text NOT NULL,
	`etag` text NOT NULL,
	`created_at` real DEFAULT (unixepoch('subsec')) NOT NULL,
	`updated_at` real DEFAULT (unixepoch('subsec')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `object_storage_file_metadata_object_key_unique` ON `object_storage_file_metadata` (`object_key`);
