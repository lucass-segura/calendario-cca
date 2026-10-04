CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`sector` text NOT NULL,
	`responsible` text NOT NULL,
	`contact` text NOT NULL,
	`date` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`service` text NOT NULL,
	`guests` integer NOT NULL,
	`notes` text NOT NULL,
	`prepared` integer DEFAULT 0 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reservations_date` ON `reservations` (`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sectors` text NOT NULL
);
