ALTER TABLE "music_albums" ADD COLUMN "createdById" text;--> statement-breakpoint
ALTER TABLE "music_artists" ADD COLUMN "createdById" text;--> statement-breakpoint
ALTER TABLE "music_playlists" ADD COLUMN "createdById" text;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "createdById" text;--> statement-breakpoint
ALTER TABLE "music_albums" ADD CONSTRAINT "music_albums_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_artists" ADD CONSTRAINT "music_artists_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_playlists" ADD CONSTRAINT "music_playlists_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;