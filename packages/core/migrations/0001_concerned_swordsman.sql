CREATE TABLE IF NOT EXISTS "micro_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"date" date NOT NULL,
	"thumbnail_url" varchar(255),
	"author_id" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"content" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"date" date NOT NULL,
	"thumbnail_url" varchar(255),
	"author_id" text,
	"genres" text[],
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"content" text
);
--> statement-breakpoint
ALTER TABLE "mixes" RENAME COLUMN "name" TO "title";--> statement-breakpoint
ALTER TABLE "mixes" ALTER COLUMN "title" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "mixes" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mixes" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "mixes" ADD COLUMN "date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "mixes" ADD COLUMN "mp3_url" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "mixes" ADD COLUMN "thumbnail_url" varchar(255);--> statement-breakpoint
ALTER TABLE "mixes" ADD COLUMN "youtube_id" varchar(50);--> statement-breakpoint
ALTER TABLE "mixes" ADD COLUMN "author_id" text;--> statement-breakpoint
ALTER TABLE "mixes" ADD COLUMN "genres" text[];--> statement-breakpoint
ALTER TABLE "mixes" ADD COLUMN "created_at" timestamp DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "mixes" ADD COLUMN "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "micro_posts" ADD CONSTRAINT "micro_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_genres_moods_id_fk" FOREIGN KEY ("genres") REFERENCES "public"."moods"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mixes" ADD CONSTRAINT "mixes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mixes" ADD CONSTRAINT "mixes_genres_moods_id_fk" FOREIGN KEY ("genres") REFERENCES "public"."moods"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
