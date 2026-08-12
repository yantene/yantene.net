CREATE TABLE `link_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`description` text,
	`site_name` text,
	`has_image` integer DEFAULT 0 NOT NULL,
	`has_favicon` integer DEFAULT 0 NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `link_cards_url_unique` ON `link_cards` (`url`);--> statement-breakpoint
CREATE INDEX `link_cards_fetched_at_idx` ON `link_cards` (`fetched_at`);