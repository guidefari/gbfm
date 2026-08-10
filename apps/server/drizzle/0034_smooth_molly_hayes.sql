ALTER TABLE "posts" ADD COLUMN "music_entity_type" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "music_entity_id" uuid;--> statement-breakpoint
CREATE INDEX "posts_music_entity_idx" ON "posts" USING btree ("music_entity_type","music_entity_id");