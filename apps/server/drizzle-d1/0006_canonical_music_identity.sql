CREATE TABLE `music_source_identities` (
	`source_key` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`source_entity_type` text NOT NULL,
	`external_id` text,
	`canonical_url` text NOT NULL,
	`state` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`owner_token` text,
	`lease_expires_at` integer,
	`resolved_at` integer,
	`last_scraped_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`platform`) REFERENCES `music_platforms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entity_type`) REFERENCES `music_entity_types`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `music_source_identities_state_check` CHECK ((`state` = 'resolving' AND `owner_token` IS NOT NULL AND `lease_expires_at` IS NOT NULL AND `entity_type` IS NULL AND `entity_id` IS NULL AND `resolved_at` IS NULL) OR (`state` = 'resolved' AND `owner_token` IS NULL AND `lease_expires_at` IS NULL AND `entity_type` IS NOT NULL AND `entity_id` IS NOT NULL AND `resolved_at` IS NOT NULL))
);--> statement-breakpoint
CREATE UNIQUE INDEX `music_source_identities_canonical_url_uq` ON `music_source_identities` (`canonical_url`);--> statement-breakpoint
CREATE UNIQUE INDEX `music_source_identities_provider_id_uq` ON `music_source_identities` (`platform`,`source_entity_type`,`external_id`) WHERE `external_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `music_source_identities_entity_idx` ON `music_source_identities` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `music_source_identities_lease_idx` ON `music_source_identities` (`state`,`lease_expires_at`);--> statement-breakpoint
CREATE TABLE `music_source_aliases` (
	`normalized_url` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`source_key`) REFERENCES `music_source_identities`(`source_key`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `music_source_aliases_source_key_idx` ON `music_source_aliases` (`source_key`);--> statement-breakpoint
CREATE TABLE `music_source_identity_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`incumbent_entity_type` text NOT NULL,
	`incumbent_entity_id` text NOT NULL,
	`candidate_entity_type` text NOT NULL,
	`candidate_entity_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`detected_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`source_key`) REFERENCES `music_source_identities`(`source_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`incumbent_entity_type`) REFERENCES `music_entity_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_entity_type`) REFERENCES `music_entity_types`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `music_source_identity_conflicts_status_check` CHECK (`status` IN ('open', 'resolved', 'ignored'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `music_source_identity_conflicts_open_uq` ON `music_source_identity_conflicts` (`source_key`,`incumbent_entity_type`,`incumbent_entity_id`,`candidate_entity_type`,`candidate_entity_id`) WHERE `status` = 'open';
