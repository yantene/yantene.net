ALTER TABLE `profile` ADD `name_en` text;--> statement-breakpoint
ALTER TABLE `profile` ADD `family_name` text;--> statement-breakpoint
ALTER TABLE `profile` ADD `given_name` text;--> statement-breakpoint
ALTER TABLE `profile` ADD `alternate_names` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `job_title` text;--> statement-breakpoint
ALTER TABLE `profile` ADD `description` text;--> statement-breakpoint
ALTER TABLE `profile` ADD `description_en` text;