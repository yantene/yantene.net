CREATE TABLE `notification_quotas` (
	`channel` text NOT NULL,
	`day` text NOT NULL,
	`sent` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`channel`, `day`)
);
