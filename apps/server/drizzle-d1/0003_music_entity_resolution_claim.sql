CREATE TABLE `music_entity_resolution_claims` (
	`entity_type` text NOT NULL,
	`canonical_url` text NOT NULL,
	`entity_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`entity_type`, `canonical_url`),
	FOREIGN KEY (`entity_type`) REFERENCES `music_entity_types`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT OR IGNORE INTO `music_entity_resolution_claims` (
	`entity_type`,
	`canonical_url`,
	`entity_id`,
	`created_at`,
	`updated_at`
)
SELECT `entity_type`, `url`, `entityId`, `createdAt`, `updatedAt`
FROM (
	SELECT
		`entity_type`,
		`url`,
		`entityId`,
		`createdAt`,
		`updatedAt`,
		row_number() OVER (
			PARTITION BY `entity_type`, `url`
			ORDER BY `createdAt`, `id`
		) AS `claim_rank`
	FROM `music_entity_links`
)
WHERE `claim_rank` = 1;
