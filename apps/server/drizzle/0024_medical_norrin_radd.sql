ALTER TABLE "audio" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
UPDATE "audio" SET "type" = 'mix' WHERE "type" = 'radio_show';--> statement-breakpoint
DROP TYPE "public"."audio_type";--> statement-breakpoint
CREATE TYPE "public"."audio_type" AS ENUM('mix', 'track', 'misc');--> statement-breakpoint
ALTER TABLE "audio" ALTER COLUMN "type" SET DATA TYPE "public"."audio_type" USING "type"::"public"."audio_type";