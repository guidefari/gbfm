CREATE TABLE "music_label_albums" (
	"label_id" uuid NOT NULL,
	"album_id" uuid NOT NULL,
	CONSTRAINT "music_label_albums_label_id_album_id_pk" PRIMARY KEY("label_id","album_id")
);
--> statement-breakpoint
CREATE TABLE "music_label_artists" (
	"label_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	CONSTRAINT "music_label_artists_label_id_artist_id_pk" PRIMARY KEY("label_id","artist_id")
);
--> statement-breakpoint
ALTER TABLE "music_label_albums" ADD CONSTRAINT "music_label_albums_label_id_music_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."music_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_label_albums" ADD CONSTRAINT "music_label_albums_album_id_music_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."music_albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_label_artists" ADD CONSTRAINT "music_label_artists_label_id_music_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."music_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_label_artists" ADD CONSTRAINT "music_label_artists_artist_id_music_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."music_artists"("id") ON DELETE cascade ON UPDATE no action;