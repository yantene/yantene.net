CREATE TABLE `work_articles` (
	`work_id` text NOT NULL,
	`position` integer NOT NULL,
	`article_slug` text NOT NULL,
	PRIMARY KEY(`work_id`, `position`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_articles_article_slug_idx` ON `work_articles` (`article_slug`);--> statement-breakpoint
CREATE TABLE `work_screenshots` (
	`work_id` text NOT NULL,
	`position` integer NOT NULL,
	`src` text NOT NULL,
	`alt` text NOT NULL,
	`kind` text DEFAULT 'desktop' NOT NULL,
	`width` integer,
	`height` integer,
	PRIMARY KEY(`work_id`, `position`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `works` ADD `stack` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `works` ADD `period_from` text;--> statement-breakpoint
ALTER TABLE `works` ADD `period_until` text;--> statement-breakpoint
ALTER TABLE `works` ADD `role` text;--> statement-breakpoint
ALTER TABLE `works` ADD `featured` integer DEFAULT false NOT NULL;