CREATE TABLE `profile_history` (
	`profile_id` text NOT NULL,
	`position` integer NOT NULL,
	`chapter` text NOT NULL,
	`year` integer NOT NULL,
	`text` text NOT NULL,
	`url` text,
	`note` text,
	PRIMARY KEY(`profile_id`, `position`),
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
