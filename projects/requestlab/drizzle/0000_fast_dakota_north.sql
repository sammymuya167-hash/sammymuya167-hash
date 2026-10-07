CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`collection_name` text NOT NULL,
	`summary_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_owner_created` ON `runs` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`content_json` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` integer NOT NULL
);
