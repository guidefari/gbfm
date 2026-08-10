CREATE TYPE "public"."reminder_status" AS ENUM('pending', 'processing', 'sent', 'failed');--> statement-breakpoint
ALTER TABLE "music_reminder" ADD COLUMN "status" "reminder_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX "music_reminder_status_idx" ON "music_reminder" USING btree ("status");