CREATE TABLE `audio_creators` (
	`audioId` text NOT NULL,
	`creatorId` text NOT NULL,
	PRIMARY KEY(`audioId`, `creatorId`),
	FOREIGN KEY (`audioId`) REFERENCES `audio`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creatorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audio_creators_creatorId_idx` ON `audio_creators` (`creatorId`);--> statement-breakpoint
CREATE TABLE `audio` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`thumbnailUrl` text,
	`bannerImageUrl` text,
	`slug` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`draft` integer DEFAULT false NOT NULL,
	`content` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`idempotencyKey` text,
	`idempotencyActorId` text,
	`idempotencyFingerprint` text,
	`showId` text,
	`episodeNumber` integer,
	`playCount` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`showId`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audio_slug_idx` ON `audio` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `audio_type_slug_unique` ON `audio` (`type`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `audio_actor_idempotency_unique` ON `audio` (`idempotencyActorId`,`idempotencyKey`);--> statement-breakpoint
CREATE INDEX `audio_show_idx` ON `audio` (`showId`);--> statement-breakpoint
CREATE INDEX `audio_type_created_idx` ON `audio` (`type`,`createdAt`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`bio` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`username` text,
	`display_username` text,
	`role` text DEFAULT 'user' NOT NULL,
	`banned` integer DEFAULT false NOT NULL,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_display_username_unique` ON `user` (`display_username`);--> statement-breakpoint
CREATE TABLE `user_social_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`url` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_social_links_user_id_idx` ON `user_social_links` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_social_links_user_position_uq` ON `user_social_links` (`user_id`,`position`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `email_delivery_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text,
	`recipientEmail` text NOT NULL,
	`recipientName` text,
	`emailType` text NOT NULL,
	`templateName` text NOT NULL,
	`subject` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`sesMessageId` text,
	`metadata` text,
	`errorMessage` text,
	`sentAt` integer,
	`deliveredAt` integer,
	`bouncedAt` integer,
	`complainedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `email_delivery_logs_userId_idx` ON `email_delivery_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `email_delivery_logs_recipientEmail_idx` ON `email_delivery_logs` (`recipientEmail`);--> statement-breakpoint
CREATE INDEX `email_delivery_logs_status_idx` ON `email_delivery_logs` (`status`);--> statement-breakpoint
CREATE INDEX `email_delivery_logs_createdAt_idx` ON `email_delivery_logs` (`createdAt`);--> statement-breakpoint
CREATE TABLE `user_email_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`mixReleaseEnabled` integer DEFAULT true NOT NULL,
	`promotionalEnabled` integer DEFAULT true NOT NULL,
	`systemEnabled` integer DEFAULT true NOT NULL,
	`globalUnsubscribe` integer DEFAULT false NOT NULL,
	`unsubscribeToken` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_preferences_userId_unique` ON `user_email_preferences` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_preferences_unsubscribeToken_unique` ON `user_email_preferences` (`unsubscribeToken`);--> statement-breakpoint
CREATE TABLE `bluesky_post_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`external_account_id` text,
	`post_id` text,
	`author_did` text NOT NULL,
	`author_handle` text,
	`at_uri` text NOT NULL,
	`cid` text,
	`public_url` text NOT NULL,
	`source_created_at` integer NOT NULL,
	`source_status` text DEFAULT 'active' NOT NULL,
	`source_fingerprint` text,
	`source_text` text,
	`source_facets` text,
	`source_embeds` text,
	`locally_edited` integer DEFAULT false NOT NULL,
	`last_seen_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`external_account_id`) REFERENCES `external_accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bluesky_post_sources_at_uri_idx` ON `bluesky_post_sources` (`at_uri`);--> statement-breakpoint
CREATE INDEX `bluesky_post_sources_account_status_idx` ON `bluesky_post_sources` (`external_account_id`,`source_status`);--> statement-breakpoint
CREATE INDEX `bluesky_post_sources_post_idx` ON `bluesky_post_sources` (`post_id`);--> statement-breakpoint
CREATE TABLE `bluesky_sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`external_account_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`discovered` integer DEFAULT 0 NOT NULL,
	`qualifying` integer DEFAULT 0 NOT NULL,
	`created` integer DEFAULT 0 NOT NULL,
	`already_imported` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`unresolved` integer DEFAULT 0 NOT NULL,
	`conflicted` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`page_count` integer DEFAULT 0 NOT NULL,
	`error_category` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`external_account_id`) REFERENCES `external_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bluesky_sync_runs_account_started_idx` ON `bluesky_sync_runs` (`external_account_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `bluesky_sync_states` (
	`external_account_id` text PRIMARY KEY NOT NULL,
	`cursor` text,
	`lookback_days` integer DEFAULT 90 NOT NULL,
	`scheduled` integer DEFAULT false NOT NULL,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`next_eligible_at` integer,
	`last_attempted_at` integer,
	`last_started_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`external_account_id`) REFERENCES `external_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `external_account_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`external_account_id` text NOT NULL,
	`app_password` text,
	`session` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`external_account_id`) REFERENCES `external_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_account_sessions_external_account_id_unique` ON `external_account_sessions` (`external_account_id`);--> statement-breakpoint
CREATE TABLE `external_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`handle` text,
	`display_name` text,
	`avatar_url` text,
	`issuer` text,
	`service_endpoint` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_error_category` text,
	`last_successful_sync_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_accounts_identity_idx` ON `external_accounts` (`user_id`,`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `external_accounts_owner_idx` ON `external_accounts` (`user_id`,`provider`,`status`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`audio_id` text,
	`show_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audio_id`) REFERENCES `audio`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `favorites_user_created_idx` ON `favorites` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_audio` ON `favorites` (`user_id`,`audio_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_show` ON `favorites` (`user_id`,`show_id`);--> statement-breakpoint
CREATE TABLE `music_album_artists` (
	`albumId` text NOT NULL,
	`artistId` text NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`role` text,
	PRIMARY KEY(`albumId`, `artistId`),
	FOREIGN KEY (`albumId`) REFERENCES `music_albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artistId`) REFERENCES `music_artists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `music_albums` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`artistNames` text,
	`releaseDate` integer,
	`coverImageUrl` text,
	`albumType` text,
	`slug` text NOT NULL,
	`publishedAt` integer,
	`createdById` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `music_albums_slug_unique` ON `music_albums` (`slug`);--> statement-breakpoint
CREATE INDEX `music_albums_slug_idx` ON `music_albums` (`slug`);--> statement-breakpoint
CREATE TABLE `music_artists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text,
	`imageUrl` text,
	`slug` text NOT NULL,
	`publishedAt` integer,
	`createdById` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `music_artists_slug_unique` ON `music_artists` (`slug`);--> statement-breakpoint
CREATE INDEX `music_artists_slug_idx` ON `music_artists` (`slug`);--> statement-breakpoint
CREATE TABLE `music_entity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entityId` text NOT NULL,
	`platform` text NOT NULL,
	`url` text NOT NULL,
	`status` text DEFAULT 'verified' NOT NULL,
	`scrapedAt` integer,
	`verifiedAt` integer,
	`verifiedBy` text,
	`metadata` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`entity_type`) REFERENCES `music_entity_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`platform`) REFERENCES `music_platforms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verifiedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `music_entity_links_entity_idx` ON `music_entity_links` (`entity_type`,`entityId`);--> statement-breakpoint
CREATE INDEX `music_entity_links_status_idx` ON `music_entity_links` (`status`);--> statement-breakpoint
CREATE INDEX `music_entity_links_platform_idx` ON `music_entity_links` (`platform`);--> statement-breakpoint
CREATE UNIQUE INDEX `music_entity_links_identity_uq` ON `music_entity_links` (`entity_type`,`entityId`,`platform`);--> statement-breakpoint
CREATE TABLE `music_entity_types` (
	`id` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `music_label_albums` (
	`label_id` text NOT NULL,
	`album_id` text NOT NULL,
	PRIMARY KEY(`label_id`, `album_id`),
	FOREIGN KEY (`label_id`) REFERENCES `music_labels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`) REFERENCES `music_albums`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `music_label_albums_album_id_idx` ON `music_label_albums` (`album_id`);--> statement-breakpoint
CREATE TABLE `music_label_artists` (
	`label_id` text NOT NULL,
	`artist_id` text NOT NULL,
	PRIMARY KEY(`label_id`, `artist_id`),
	FOREIGN KEY (`label_id`) REFERENCES `music_labels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `music_artists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `music_label_artists_artist_id_idx` ON `music_label_artists` (`artist_id`);--> statement-breakpoint
CREATE TABLE `music_label_creators` (
	`label_id` text NOT NULL,
	`creator_id` text NOT NULL,
	PRIMARY KEY(`label_id`, `creator_id`),
	FOREIGN KEY (`label_id`) REFERENCES `music_labels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creator_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `music_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`image_url` text,
	`banner_image_url` text,
	`slug` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`published_at` integer,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `music_labels_slug_unique` ON `music_labels` (`slug`);--> statement-breakpoint
CREATE INDEX `music_labels_slug_idx` ON `music_labels` (`slug`);--> statement-breakpoint
CREATE TABLE `music_platforms` (
	`id` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`websiteUrl` text,
	`iconUrl` text
);
--> statement-breakpoint
CREATE TABLE `music_playlist_tracks` (
	`playlistId` text NOT NULL,
	`trackId` text NOT NULL,
	`position` integer NOT NULL,
	`addedAt` integer NOT NULL,
	PRIMARY KEY(`playlistId`, `trackId`),
	FOREIGN KEY (`playlistId`) REFERENCES `music_playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trackId`) REFERENCES `music_tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `music_playlist_tracks_position_idx` ON `music_playlist_tracks` (`playlistId`,`position`);--> statement-breakpoint
CREATE TABLE `music_playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`coverImageUrl` text,
	`curatorId` text,
	`slug` text NOT NULL,
	`publishedAt` integer,
	`createdById` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`curatorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `music_playlists_slug_unique` ON `music_playlists` (`slug`);--> statement-breakpoint
CREATE INDEX `music_playlists_slug_idx` ON `music_playlists` (`slug`);--> statement-breakpoint
CREATE TABLE `music_track_artists` (
	`trackId` text NOT NULL,
	`artistId` text NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`role` text,
	PRIMARY KEY(`trackId`, `artistId`),
	FOREIGN KEY (`trackId`) REFERENCES `music_tracks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artistId`) REFERENCES `music_artists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `music_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`artistNames` text,
	`coverImageUrl` text,
	`albumId` text,
	`trackNumber` integer,
	`slug` text NOT NULL,
	`publishedAt` integer,
	`createdById` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`albumId`) REFERENCES `music_albums`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `music_tracks_slug_unique` ON `music_tracks` (`slug`);--> statement-breakpoint
CREATE INDEX `music_tracks_slug_idx` ON `music_tracks` (`slug`);--> statement-breakpoint
CREATE TABLE `music_reminder` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`music_title` text NOT NULL,
	`artist_name` text NOT NULL,
	`music_url` text NOT NULL,
	`album_cover_url` text,
	`reminder_date` integer NOT NULL,
	`notes` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`is_sent` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `music_reminder_user_id_idx` ON `music_reminder` (`user_id`);--> statement-breakpoint
CREATE INDEX `music_reminder_reminder_date_idx` ON `music_reminder` (`reminder_date`);--> statement-breakpoint
CREATE INDEX `music_reminder_is_sent_idx` ON `music_reminder` (`is_sent`);--> statement-breakpoint
CREATE INDEX `music_reminder_status_idx` ON `music_reminder` (`status`);--> statement-breakpoint
CREATE TABLE `navigation_seen_posts` (
	`sessionId` text NOT NULL,
	`slug` text NOT NULL,
	FOREIGN KEY (`sessionId`) REFERENCES `navigation_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `navigation_seen_session_slug_uq` ON `navigation_seen_posts` (`sessionId`,`slug`);--> statement-breakpoint
CREATE TABLE `navigation_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text,
	`deviceToken` text,
	`cursor` integer DEFAULT 0 NOT NULL,
	`lastIntentToken` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `navigation_sessions_user_uq` ON `navigation_sessions` (`userId`) WHERE "navigation_sessions"."userId" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `navigation_sessions_device_uq` ON `navigation_sessions` (`deviceToken`) WHERE "navigation_sessions"."deviceToken" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `navigation_trail_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`postId` text NOT NULL,
	`slug` text NOT NULL,
	`position` integer NOT NULL,
	`arrivedBy` text NOT NULL,
	`visitedAt` integer NOT NULL,
	FOREIGN KEY (`sessionId`) REFERENCES `navigation_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `navigation_trail_session_position_uq` ON `navigation_trail_entries` (`sessionId`,`position`);--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`source` text,
	`userId` text,
	`unsubscribeToken` text,
	`unsubscribedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscribers_email_unique` ON `newsletter_subscribers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscribers_unsubscribeToken_unique` ON `newsletter_subscribers` (`unsubscribeToken`);--> statement-breakpoint
CREATE INDEX `newsletter_subscribers_email_idx` ON `newsletter_subscribers` (`email`);--> statement-breakpoint
CREATE INDEX `newsletter_subscribers_userId_idx` ON `newsletter_subscribers` (`userId`);--> statement-breakpoint
CREATE TABLE `post_creators` (
	`postId` text NOT NULL,
	`creatorId` text NOT NULL,
	PRIMARY KEY(`postId`, `creatorId`),
	FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creatorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_creators_creatorId_idx` ON `post_creators` (`creatorId`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text,
	`thumbnailUrl` text,
	`bannerImageUrl` text,
	`slug` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`draft` integer DEFAULT false NOT NULL,
	`title` text,
	`content` text,
	`type` text,
	`music_entity_type` text,
	`music_entity_id` text,
	`parent_post_id` text,
	`root_post_id` text,
	`depth` integer DEFAULT 0 NOT NULL,
	`quoted_post_id` text,
	FOREIGN KEY (`parent_post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`root_post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`quoted_post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `posts_slug_idx` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_music_entity_idx` ON `posts` (`music_entity_type`,`music_entity_id`);--> statement-breakpoint
CREATE INDEX `posts_type_created_idx` ON `posts` (`type`,`createdAt`);--> statement-breakpoint
CREATE INDEX `posts_parent_created_idx` ON `posts` (`parent_post_id`,`createdAt`);--> statement-breakpoint
CREATE INDEX `posts_root_created_idx` ON `posts` (`root_post_id`,`createdAt`);--> statement-breakpoint
CREATE INDEX `posts_quoted_post_idx` ON `posts` (`quoted_post_id`);--> statement-breakpoint
CREATE TABLE `releases` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`thumbnailUrl` text,
	`bannerImageUrl` text,
	`slug` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`draft` integer DEFAULT false NOT NULL,
	`content` text NOT NULL,
	`labelId` text NOT NULL,
	`releaseDate` integer,
	`streamingLinks` text,
	FOREIGN KEY (`labelId`) REFERENCES `music_labels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `releases_slug_idx` ON `releases` (`slug`);--> statement-breakpoint
CREATE TABLE `show_creators` (
	`showId` text NOT NULL,
	`creatorId` text NOT NULL,
	PRIMARY KEY(`showId`, `creatorId`),
	FOREIGN KEY (`showId`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creatorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `show_creators_creatorId_idx` ON `show_creators` (`creatorId`);--> statement-breakpoint
CREATE TABLE `show_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`showId` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`showId`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `show_subscriptions_user_idx` ON `show_subscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `show_subscriptions_show_idx` ON `show_subscriptions` (`showId`);--> statement-breakpoint
CREATE UNIQUE INDEX `show_subscriptions_user_show_unique` ON `show_subscriptions` (`userId`,`showId`);--> statement-breakpoint
CREATE TABLE `shows` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`thumbnailUrl` text,
	`bannerImageUrl` text,
	`slug` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`draft` integer DEFAULT false NOT NULL,
	`content` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shows_slug_idx` ON `shows` (`slug`);--> statement-breakpoint
CREATE TABLE `entity_labels` (
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`position` integer NOT NULL,
	`label_id` text NOT NULL,
	PRIMARY KEY(`entity_type`, `entity_id`, `label_id`),
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_labels_label_idx` ON `entity_labels` (`label_id`,`entity_type`);--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labels_kind_name_uq` ON `labels` (`kind`,`name`);--> statement-breakpoint
CREATE TABLE `upload_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`bucket` text NOT NULL,
	`asset_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`upload_id` text,
	`expected_size` integer,
	`attached_to_table` text,
	`attached_to_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `upload_assets_user_id_idx` ON `upload_assets` (`user_id`);--> statement-breakpoint
CREATE INDEX `upload_assets_status_idx` ON `upload_assets` (`status`);--> statement-breakpoint
CREATE INDEX `upload_assets_expires_at_idx` ON `upload_assets` (`expires_at`);--> statement-breakpoint
CREATE INDEX `upload_assets_attached_to_idx` ON `upload_assets` (`attached_to_table`,`attached_to_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `upload_assets_key_unique` ON `upload_assets` (`key`);
