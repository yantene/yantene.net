CREATE TABLE `error_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`level` text DEFAULT 'error' NOT NULL,
	`message` text NOT NULL,
	`stack` text,
	`context` text,
	`created_at` real DEFAULT (unixepoch('subsec')) NOT NULL,
	`updated_at` real DEFAULT (unixepoch('subsec')) NOT NULL
);
