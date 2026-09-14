CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tagline` text NOT NULL,
	`avatar_url` text,
	`source_hash` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile_socials` (
	`profile_id` text NOT NULL,
	`position` integer NOT NULL,
	`platform` text NOT NULL,
	`url` text NOT NULL,
	`is_me` integer NOT NULL,
	PRIMARY KEY(`profile_id`, `position`),
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
