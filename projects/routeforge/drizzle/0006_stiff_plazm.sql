CREATE TABLE `merchant_branches` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`name` text NOT NULL,
	`location_json` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `merchant_branches_tenant` ON `merchant_branches` (`merchant_id`);--> statement-breakpoint
CREATE TABLE `merchant_deliveries` (
	`order_id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`external_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`input_json` text NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`fee_minor` integer NOT NULL,
	`area_id` text NOT NULL,
	`pricing_version` integer NOT NULL,
	`rider_owner` text,
	`fleet` text,
	`tracking_hash` text NOT NULL,
	`otp_hash` text NOT NULL,
	`proof_json` text,
	`dispatch_lease_until` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`exception` text,
	FOREIGN KEY (`order_id`) REFERENCES `office_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `merchant_branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `service_areas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchant_deliveries_tracking_hash_unique` ON `merchant_deliveries` (`tracking_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_external_tenant` ON `merchant_deliveries` (`merchant_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `delivery_retry` ON `merchant_deliveries` (`ready`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `merchant_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`secret_cipher` text NOT NULL,
	`webhook_url` text,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchant_integrations_key_hash_unique` ON `merchant_integrations` (`key_hash`);--> statement-breakpoint
CREATE INDEX `integrations_tenant` ON `merchant_integrations` (`merchant_id`);--> statement-breakpoint
CREATE TABLE `merchant_staff` (
	`account_id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `company_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `merchant_staff_tenant` ON `merchant_staff` (`merchant_id`);--> statement-breakpoint
CREATE TABLE `merchants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`fleet_mode` text DEFAULT 'owned' NOT NULL,
	`fallback_enabled` integer DEFAULT 0 NOT NULL,
	`accepted_pricing_version` integer,
	`subscription` text DEFAULT 'standard' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `network_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`subject_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `network_audit_tenant` ON `network_audit` (`merchant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `network_events` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`order_id` text,
	`event_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `network_event_tenant` ON `network_events` (`merchant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `network_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`device_id` text NOT NULL,
	`status` text NOT NULL,
	`fleet` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `office_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`device_id`) REFERENCES `tracking_devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `network_offer_order` ON `network_offers` (`order_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `network_one_pending_offer` ON `network_offers` (`order_id`) WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX `network_offer_device` ON `network_offers` (`device_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `network_riders` (
	`device_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`merchant_id` text,
	`vehicle_type` text NOT NULL,
	`capacity_grams` integer NOT NULL,
	`area_id` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `tracking_devices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `service_areas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `network_riders_tenant` ON `network_riders` (`merchant_id`,`area_id`);--> statement-breakpoint
CREATE TABLE `service_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`config_json` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhook_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`integration_id` text NOT NULL,
	`event_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`last_status` integer,
	FOREIGN KEY (`integration_id`) REFERENCES `merchant_integrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `network_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_event_once` ON `webhook_outbox` (`integration_id`,`event_id`);--> statement-breakpoint
CREATE INDEX `webhook_retry` ON `webhook_outbox` (`status`,`next_attempt_at`);