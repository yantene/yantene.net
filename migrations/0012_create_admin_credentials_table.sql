CREATE TABLE `admin_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`algorithm` text NOT NULL,
	`sign_count` integer DEFAULT 0 NOT NULL,
	`label` text NOT NULL,
	`backed_up` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer
);
