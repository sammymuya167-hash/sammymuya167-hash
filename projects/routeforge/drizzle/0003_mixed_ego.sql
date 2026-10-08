CREATE TABLE `office_driver_profiles` (
	`device_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`profile_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `tracking_devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `office_profiles_owner` ON `office_driver_profiles` (`owner_id`);--> statement-breakpoint
CREATE TABLE `office_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`device_id` text,
	`dispatch_id` text,
	`status` text NOT NULL,
	`input_json` text NOT NULL,
	`payload_json` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `office_orders_owner_status` ON `office_orders` (`owner_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `office_orders_dispatch` ON `office_orders` (`dispatch_id`);--> statement-breakpoint
CREATE TABLE `office_partners` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `office_partners_owner` ON `office_partners` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `office_settings` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `place_search_cache` (
	`owner_id` text NOT NULL,
	`cache_key` text NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `cache_key`)
);
--> statement-breakpoint
CREATE TABLE `place_search_gate` (
	`provider` text PRIMARY KEY NOT NULL,
	`next_allowed_at` integer NOT NULL
);
