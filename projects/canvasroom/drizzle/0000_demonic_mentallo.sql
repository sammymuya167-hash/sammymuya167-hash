CREATE TABLE `boards` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`content_json` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`content_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `snapshots_owner_created` ON `snapshots` (`owner_id`,`created_at`);