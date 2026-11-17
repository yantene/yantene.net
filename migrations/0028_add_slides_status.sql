ALTER TABLE `slides` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
CREATE INDEX `slides_status_idx` ON `slides` (`status`);