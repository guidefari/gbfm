ALTER TABLE `music_entity_resolution_claims` ADD COLUMN `owner_token` text;--> statement-breakpoint
ALTER TABLE `music_entity_resolution_claims` ADD COLUMN `lease_expires_at` integer;--> statement-breakpoint
UPDATE `music_entity_resolution_claims`
SET `lease_expires_at` = unixepoch() * 1000
WHERE `entity_id` IS NULL;
