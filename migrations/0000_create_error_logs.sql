CREATE TABLE `error_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`level` text DEFAULT 'error' NOT NULL,
	`message` text NOT NULL,
	`stack` text,
	`context` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
