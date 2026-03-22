ALTER TABLE "music_playlists" ADD COLUMN "isPublic" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "playlist_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlistId" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"url" varchar(2048) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"artistNames" varchar(255)[],
	"thumbnailUrl" varchar(512),
	"durationMs" integer,
	"bpm" numeric(5, 1),
	"musicalKey" varchar(10),
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlistId_music_playlists_id_fk" FOREIGN KEY ("playlistId") REFERENCES "public"."music_playlists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_platform_music_platforms_id_fk" FOREIGN KEY ("platform") REFERENCES "public"."music_platforms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "playlist_tracks_playlist_idx" ON "playlist_tracks" USING btree ("playlistId");
--> statement-breakpoint
CREATE INDEX "playlist_tracks_position_idx" ON "playlist_tracks" USING btree ("playlistId","position");
