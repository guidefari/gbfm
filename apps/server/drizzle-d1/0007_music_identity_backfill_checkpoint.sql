CREATE INDEX `music_entity_links_backfill_page_idx` ON `music_entity_links` (`createdAt`, `id`);--> statement-breakpoint
CREATE INDEX `music_entity_resolution_claims_backfill_page_idx` ON `music_entity_resolution_claims` (`updated_at`, `entity_type`, `canonical_url`) WHERE `entity_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `music_source_identities_resolving_audit_page_idx` ON `music_source_identities` (`state`, `source_key`);--> statement-breakpoint
CREATE INDEX `music_source_identity_conflicts_audit_page_idx` ON `music_source_identity_conflicts` (`status`, `detected_at`, `id`);--> statement-breakpoint
CREATE TABLE `music_identity_maintenance_runs` (
	`generation_id` text PRIMARY KEY NOT NULL,
	`operation` text NOT NULL,
	`phase` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`link_high_water_created_at` integer NOT NULL,
	`link_high_water_id` text NOT NULL,
	`claim_high_water_updated_at` integer NOT NULL,
	`claim_high_water_entity_type` text NOT NULL,
	`claim_high_water_canonical_url` text NOT NULL,
	`cursor_created_at` integer DEFAULT -1 NOT NULL,
	`cursor_id` text DEFAULT '' NOT NULL,
	`claim_cursor_updated_at` integer DEFAULT -1 NOT NULL,
	`claim_cursor_entity_type` text DEFAULT '' NOT NULL,
	`claim_cursor_canonical_url` text DEFAULT '' NOT NULL,
	`apply_cursor_source_key` text DEFAULT '' NOT NULL,
	`scanned_count` integer DEFAULT 0 NOT NULL,
	`candidate_count` integer DEFAULT 0 NOT NULL,
	`attempted_count` integer DEFAULT 0 NOT NULL,
	`invalid_count` integer DEFAULT 0 NOT NULL,
	`orphan_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `music_identity_maintenance_runs_phase_check` CHECK (`phase` IN ('scan_links', 'scan_claims', 'apply', 'complete'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `music_identity_maintenance_runs_active_uq` ON `music_identity_maintenance_runs` (`operation`) WHERE `active` = 1;--> statement-breakpoint
CREATE TABLE `music_identity_maintenance_candidates` (
	`generation_id` text NOT NULL,
	`source_key` text NOT NULL,
	`origin` text NOT NULL,
	`origin_key` text NOT NULL,
	`platform` text NOT NULL,
	`source_entity_type` text NOT NULL,
	`external_id` text,
	`canonical_url` text NOT NULL,
	`source_url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`status` text NOT NULL,
	`verified_at` integer,
	`scraped_at` integer,
	`created_at` integer NOT NULL,
	PRIMARY KEY (`generation_id`, `origin`, `origin_key`),
	FOREIGN KEY (`generation_id`) REFERENCES `music_identity_maintenance_runs`(`generation_id`) ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `music_identity_maintenance_candidates_source_page_idx` ON `music_identity_maintenance_candidates` (`generation_id`, `source_key`, `origin`, `origin_key`);--> statement-breakpoint
CREATE TABLE `music_identity_maintenance_source_keys` (
	`generation_id` text NOT NULL,
	`source_key` text NOT NULL,
	PRIMARY KEY (`generation_id`, `source_key`),
	FOREIGN KEY (`generation_id`) REFERENCES `music_identity_maintenance_runs`(`generation_id`) ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE `music_identity_maintenance_findings` (
	`generation_id` text NOT NULL,
	`finding_key` text NOT NULL,
	`category` text NOT NULL,
	`source_key` text,
	`origin_key` text,
	`entity_type` text,
	`entity_id` text,
	`detail` text NOT NULL,
	`detected_at` integer NOT NULL,
	PRIMARY KEY (`generation_id`, `finding_key`),
	FOREIGN KEY (`generation_id`) REFERENCES `music_identity_maintenance_runs`(`generation_id`) ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `music_identity_maintenance_findings_page_idx` ON `music_identity_maintenance_findings` (`generation_id`, `category`, `finding_key`);--> statement-breakpoint
CREATE TABLE `music_identity_maintenance_actions` (
	`generation_id` text NOT NULL,
	`action_key` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY (`generation_id`, `action_key`),
	FOREIGN KEY (`generation_id`) REFERENCES `music_identity_maintenance_runs`(`generation_id`) ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `music_identity_maintenance_actions_kind_idx` ON `music_identity_maintenance_actions` (`generation_id`, `kind`);
