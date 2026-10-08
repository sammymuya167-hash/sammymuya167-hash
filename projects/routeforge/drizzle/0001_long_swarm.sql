CREATE TABLE `tracking_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`driver_name` text NOT NULL,
	`vehicle_label` text DEFAULT '' NOT NULL,
	`phone_label` text DEFAULT '' NOT NULL,
	`device_name` text,
	`created_at` integer NOT NULL,
	`paired_at` integer,
	`pair_code_hash` text,
	`pair_expires_at` integer,
	`token_hash` text,
	`revoked_at` integer,
	`last_seen_at` integer,
	`last_event_at` integer,
	`last_event_kind` text,
	`latest_point_at` integer,
	`latest_point_json` text
);
--> statement-breakpoint
CREATE INDEX `tracking_devices_owner` ON `tracking_devices` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tracking_pair_code` ON `tracking_devices` (`pair_code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `tracking_token` ON `tracking_devices` (`token_hash`);--> statement-breakpoint
CREATE TABLE `tracking_events` (
	`device_id` text NOT NULL,
	`event_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`kind` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`payload_json` text NOT NULL,
	PRIMARY KEY(`device_id`, `event_id`),
	FOREIGN KEY (`device_id`) REFERENCES `tracking_devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tracking_events_history` ON `tracking_events` (`device_id`,`recorded_at`,`event_id`);--> statement-breakpoint
CREATE INDEX `tracking_events_trip` ON `tracking_events` (`device_id`,`trip_id`);