CREATE TABLE `clicks` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` real DEFAULT (unixepoch('subsec')) NOT NULL,
	`updated_at` real DEFAULT (unixepoch('subsec')) NOT NULL
);
