CREATE TABLE `rtc_members` (
	`room` text NOT NULL,
	`user` text NOT NULL,
	`connection` text NOT NULL,
	`pub_session` text,
	`sub_session` text,
	`pub_tracks` text DEFAULT '[]' NOT NULL,
	`sub_tracks` text DEFAULT '[]' NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`heartbeat` integer NOT NULL,
	`lock_until` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`room`, `user`),
	FOREIGN KEY (`room`) REFERENCES `rtc_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rtc_members_heartbeat` ON `rtc_members` (`heartbeat`);--> statement-breakpoint
CREATE TABLE `rtc_presence` (
	`user` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room`) REFERENCES `rtc_rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rtc_presence_room` ON `rtc_presence` (`room`);--> statement-breakpoint
CREATE TABLE `rtc_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`guest` text,
	`kind` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT 'public' NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`ended_reason` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`host`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rtc_rooms_host` ON `rtc_rooms` (`host`,`created_at`);--> statement-breakpoint
CREATE INDEX `rtc_rooms_guest` ON `rtc_rooms` (`guest`,`state`);--> statement-breakpoint
CREATE INDEX `rtc_rooms_state` ON `rtc_rooms` (`state`,`created_at`);