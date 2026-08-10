ALTER TABLE "public"."posts" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."post_type";--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('post', 'micro');--> statement-breakpoint
ALTER TABLE "public"."posts" ALTER COLUMN "type" SET DATA TYPE "public"."post_type" USING "type"::"public"."post_type";