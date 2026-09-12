CREATE TABLE `passkey_ceremonies` (
	`challenge` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `passkey_ceremonies_expires_at_idx` ON `passkey_ceremonies` (`expires_at`);