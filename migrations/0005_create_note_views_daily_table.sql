CREATE TABLE `note_views_daily` (
	`note_id` text NOT NULL,
	`viewed_on` text NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`note_id`, `viewed_on`),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_views_daily_viewed_on_idx` ON `note_views_daily` (`viewed_on`);