CREATE TABLE `audio_artists` (
  `audio_id` text NOT NULL REFERENCES `audio`(`id`) ON DELETE cascade,
  `artist_id` text NOT NULL REFERENCES `music_artists`(`id`) ON DELETE cascade,
  `position` integer NOT NULL DEFAULT 0,
  PRIMARY KEY (`audio_id`, `artist_id`)
);
--> statement-breakpoint
CREATE INDEX `audio_artists_artist_id_idx` ON `audio_artists` (`artist_id`);
