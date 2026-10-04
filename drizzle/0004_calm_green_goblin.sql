CREATE TABLE `mission_people` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mission_places` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mission_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`place_id` text NOT NULL,
	`people_json` text NOT NULL,
	`notes` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_mission_trips_date` ON `mission_trips` (`date`);