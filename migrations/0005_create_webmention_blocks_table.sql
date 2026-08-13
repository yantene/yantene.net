CREATE TABLE `webmention_blocks` (
	`host` text PRIMARY KEY NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL
);
