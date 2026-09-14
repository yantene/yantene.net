CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`birthplace` text,
	`tagline` text NOT NULL,
	`socials` text NOT NULL,
	`source_hash` text DEFAULT '' NOT NULL,
	CONSTRAINT "profile_single_row" CHECK("profile"."id" = 1)
);
