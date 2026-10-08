CREATE TABLE `driver_receipts` (
	`device_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`request_json` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`device_id`, `operation_id`)
);
--> statement-breakpoint
CREATE INDEX `driver_receipts_owner` ON `driver_receipts` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `driver_runtime` (
	`device_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`app_version` integer DEFAULT 1 NOT NULL,
	`on_duty` integer DEFAULT 0 NOT NULL,
	`gps_enabled` integer DEFAULT 0 NOT NULL,
	`heartbeat_at` integer NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `tracking_devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `driver_runtime_owner` ON `driver_runtime` (`owner_id`);--> statement-breakpoint
CREATE TABLE `office_payments` (
	`order_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`device_id` text NOT NULL,
	`status` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `office_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `office_payments_owner` ON `office_payments` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `order_offers` (
	`order_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`eligible_json` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `office_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_offers_owner_deadline` ON `order_offers` (`owner_id`,`expires_at`);