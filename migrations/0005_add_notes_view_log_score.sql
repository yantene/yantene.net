ALTER TABLE `notes` ADD `view_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `view_log_score` real;--> statement-breakpoint
CREATE INDEX `notes_view_log_score_idx` ON `notes` (`view_log_score`);