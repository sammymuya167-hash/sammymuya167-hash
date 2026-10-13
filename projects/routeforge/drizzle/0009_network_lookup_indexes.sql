CREATE INDEX `network_delivery_rider` ON `merchant_deliveries` (`rider_owner`,`order_id`);--> statement-breakpoint
CREATE INDEX `network_events_order` ON `network_events` (`order_id`);