CREATE TYPE "public"."audio_type" AS ENUM('mix', 'track', 'misc');--> statement-breakpoint
CREATE TABLE "audio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"thumbnailUrl" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"tags" varchar(255)[],
	"content" text NOT NULL,
	"type" "audio_type" NOT NULL,
	"url" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_to_authors" (
	"audioId" uuid NOT NULL,
	"authorId" uuid NOT NULL,
	CONSTRAINT "audio_to_authors_audioId_authorId_pk" PRIMARY KEY("audioId","authorId")
);
--> statement-breakpoint
ALTER TABLE "author_sessions" ALTER COLUMN "refreshToken" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "authors" ADD COLUMN "avatarUrl" varchar(255);--> statement-breakpoint
ALTER TABLE "audio_to_authors" ADD CONSTRAINT "audio_to_authors_audioId_audio_id_fk" FOREIGN KEY ("audioId") REFERENCES "public"."audio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_to_authors" ADD CONSTRAINT "audio_to_authors_authorId_authors_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audio_slug_idx" ON "audio" USING btree ("slug");