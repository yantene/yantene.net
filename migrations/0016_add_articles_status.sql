ALTER TABLE `articles` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
CREATE INDEX `articles_status_idx` ON `articles` (`status`);