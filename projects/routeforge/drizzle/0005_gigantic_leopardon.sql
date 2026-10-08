CREATE TABLE `company_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`username` text NOT NULL,
	`username_key` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`device_id` text,
	`phone` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_accounts_username_key_unique` ON `company_accounts` (`username_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `company_accounts_device_id_unique` ON `company_accounts` (`device_id`);--> statement-breakpoint
CREATE INDEX `company_accounts_owner` ON `company_accounts` (`owner_id`,`role`);--> statement-breakpoint
CREATE TABLE `login_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `office_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`account_version` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `company_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `office_sessions_expiry` ON `office_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `rider_logins` (
	`device_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`account_version` integer NOT NULL,
	`token_hash` text NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `tracking_devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `company_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
