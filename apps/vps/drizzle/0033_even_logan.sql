CREATE TABLE "music_albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"artistNames" varchar(255)[],
	"artistId" uuid,
	"releaseDate" timestamp with time zone,
	"coverImageUrl" varchar(512),
	"genres" varchar(255)[],
	"albumType" varchar(50),
	"slug" varchar(255) NOT NULL,
	"publishedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_albums_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "music_artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"bio" text,
	"imageUrl" varchar(512),
	"genres" varchar(255)[],
	"slug" varchar(255) NOT NULL,
	"publishedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_artists_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "music_entity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entityType" varchar(50) NOT NULL,
	"entityId" uuid NOT NULL,
	"platform" varchar(50) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"status" varchar(50) DEFAULT 'pending_review' NOT NULL,
	"scrapedAt" timestamp with time zone,
	"verifiedAt" timestamp with time zone,
	"verifiedBy" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_entity_links_unique_platform" UNIQUE("entityType","entityId","platform")
);
--> statement-breakpoint
CREATE TABLE "music_playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"coverImageUrl" varchar(512),
	"curatorId" text,
	"slug" varchar(255) NOT NULL,
	"publishedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_playlists_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "music_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"artistNames" varchar(255)[],
	"artistId" uuid,
	"albumId" uuid,
	"duration" integer,
	"trackNumber" integer,
	"slug" varchar(255) NOT NULL,
	"publishedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_tracks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "music_albums" ADD CONSTRAINT "music_albums_artistId_music_artists_id_fk" FOREIGN KEY ("artistId") REFERENCES "public"."music_artists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_entity_links" ADD CONSTRAINT "music_entity_links_verifiedBy_user_id_fk" FOREIGN KEY ("verifiedBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_playlists" ADD CONSTRAINT "music_playlists_curatorId_user_id_fk" FOREIGN KEY ("curatorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_artistId_music_artists_id_fk" FOREIGN KEY ("artistId") REFERENCES "public"."music_artists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_albumId_music_albums_id_fk" FOREIGN KEY ("albumId") REFERENCES "public"."music_albums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "music_albums_slug_idx" ON "music_albums" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "music_artists_slug_idx" ON "music_artists" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "music_entity_links_entity_idx" ON "music_entity_links" USING btree ("entityType","entityId");--> statement-breakpoint
CREATE INDEX "music_entity_links_status_idx" ON "music_entity_links" USING btree ("status");--> statement-breakpoint
CREATE INDEX "music_playlists_slug_idx" ON "music_playlists" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "music_tracks_slug_idx" ON "music_tracks" USING btree ("slug");