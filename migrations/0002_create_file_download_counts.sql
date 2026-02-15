CREATE TABLE `file_download_counts` (
	`object_key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`object_key`) REFERENCES `object_storage_file_metadata`(`object_key`) ON UPDATE no action ON DELETE no action
);
