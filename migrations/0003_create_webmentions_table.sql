CREATE TABLE `webmentions` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`target` text NOT NULL,
	`source` text NOT NULL,
	`type` text NOT NULL,
	`author_name` text,
	`author_url` text,
	`author_photo` text,
	`content` text,
	`published_at` integer,
	`received_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webmentions_note_id_source_idx` ON `webmentions` (`note_id`,`source`);