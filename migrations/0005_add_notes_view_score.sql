ALTER TABLE `notes` ADD `view_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `view_score` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `view_scored_on` text;