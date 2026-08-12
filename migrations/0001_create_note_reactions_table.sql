CREATE TABLE `note_reactions` (
	`note_id` text NOT NULL,
	`emoji` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`note_id`, `emoji`),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
