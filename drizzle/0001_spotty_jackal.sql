ALTER TABLE `reservations` ADD `series_id` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `repeat_ordinal` integer;--> statement-breakpoint
ALTER TABLE `reservations` ADD `repeat_weekday` integer;--> statement-breakpoint
ALTER TABLE `reservations` ADD `repeat_until` text;--> statement-breakpoint
CREATE INDEX `idx_reservations_series` ON `reservations` (`series_id`);