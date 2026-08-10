ALTER TABLE `email_delivery_logs` ADD COLUMN `provider` text;--> statement-breakpoint
ALTER TABLE `email_delivery_logs` ADD COLUMN `providerMessageId` text;--> statement-breakpoint
ALTER TABLE `email_delivery_logs` ADD COLUMN `failureCategory` text;--> statement-breakpoint
UPDATE `email_delivery_logs`
SET `provider` = 'ses', `providerMessageId` = `sesMessageId`
WHERE `sesMessageId` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `email_delivery_logs` DROP COLUMN `sesMessageId`;
