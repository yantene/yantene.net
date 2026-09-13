CREATE TABLE `sign_in_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`request_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sign_in_tokens_email_idx` ON `sign_in_tokens` (`email`);--> statement-breakpoint
CREATE INDEX `sign_in_tokens_expires_at_idx` ON `sign_in_tokens` (`expires_at`);