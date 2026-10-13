CREATE TABLE `merchant_pricing_acceptance` (
	`merchant_id` text NOT NULL,
	`area_id` text NOT NULL,
	`version` integer NOT NULL,
	`terms_json` text NOT NULL,
	`accepted_by` text NOT NULL,
	`accepted_at` integer NOT NULL,
	PRIMARY KEY(`merchant_id`, `area_id`),
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `service_areas`(`id`) ON UPDATE no action ON DELETE no action
);
