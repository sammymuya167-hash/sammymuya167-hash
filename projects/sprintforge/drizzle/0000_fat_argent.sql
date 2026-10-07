CREATE TABLE `workspaces` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`board_json` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` integer NOT NULL
);
