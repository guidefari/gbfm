CREATE TABLE "music_playlist_tracks" (
	"playlistId" uuid NOT NULL,
	"trackId" uuid NOT NULL,
	"position" integer NOT NULL,
	"addedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_playlist_tracks_playlistId_trackId_pk" PRIMARY KEY("playlistId","trackId")
);
--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "coverImageUrl" varchar(512);--> statement-breakpoint
ALTER TABLE "music_playlist_tracks" ADD CONSTRAINT "music_playlist_tracks_playlistId_music_playlists_id_fk" FOREIGN KEY ("playlistId") REFERENCES "public"."music_playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_playlist_tracks" ADD CONSTRAINT "music_playlist_tracks_trackId_music_tracks_id_fk" FOREIGN KEY ("trackId") REFERENCES "public"."music_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "music_playlist_tracks_position_idx" ON "music_playlist_tracks" USING btree ("playlistId","position");