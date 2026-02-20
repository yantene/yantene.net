CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`etag` text NOT NULL,
	`image_url` text NOT NULL,
	`published_on` text NOT NULL,
	`last_modified_on` text NOT NULL,
	`created_at` real DEFAULT (unixepoch('subsec')) NOT NULL,
	`updated_at` real DEFAULT (unixepoch('subsec')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notes_slug_unique` ON `notes` (`slug`);
