CREATE TABLE `works` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`summary` text NOT NULL,
	`url` text,
	`position` integer NOT NULL,
	`source_hash` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `works_slug_unique` ON `works` (`slug`);--> statement-breakpoint
CREATE INDEX `works_position_idx` ON `works` (`position`);