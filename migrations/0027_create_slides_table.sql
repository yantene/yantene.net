CREATE TABLE `slides` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`published_on` text NOT NULL,
	`event_name` text,
	`event_date` text,
	`event_url` text,
	`summary` text NOT NULL,
	`page_count` integer NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`source_hash` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slides_slug_unique` ON `slides` (`slug`);--> statement-breakpoint
CREATE INDEX `slides_published_on_idx` ON `slides` (`published_on`);--> statement-breakpoint
CREATE INDEX `slides_status_idx` ON `slides` (`status`);