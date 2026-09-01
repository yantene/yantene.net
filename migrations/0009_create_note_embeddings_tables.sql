CREATE TABLE `note_embeddings` (
	`note_id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`content_hash` text NOT NULL,
	`dimensions` integer NOT NULL,
	`vector` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `note_similarities` (
	`note_id` text NOT NULL,
	`other_note_id` text NOT NULL,
	`similarity` real NOT NULL,
	PRIMARY KEY(`note_id`, `other_note_id`),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`other_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_similarities_note_id_similarity_idx` ON `note_similarities` (`note_id`,`similarity`);