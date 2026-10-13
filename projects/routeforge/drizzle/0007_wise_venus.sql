CREATE TABLE `network_ledger` (
	`order_id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`device_id` text NOT NULL,
	`fee_minor` integer NOT NULL,
	`commission_minor` integer NOT NULL,
	`rider_earning_minor` integer,
	`state` text DEFAULT 'pending_review' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `merchant_deliveries`(`order_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `network_ledger_tenant` ON `network_ledger` (`merchant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `network_ledger_rider` ON `network_ledger` (`device_id`);--> statement-breakpoint
ALTER TABLE `merchant_deliveries` ADD `commission_bps` integer DEFAULT 0 NOT NULL;