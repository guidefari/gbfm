CREATE INDEX "audio_creators_creatorId_idx" ON "audio_creators" USING btree ("creatorId");--> statement-breakpoint
CREATE INDEX "post_creators_creatorId_idx" ON "post_creators" USING btree ("creatorId");--> statement-breakpoint
CREATE INDEX "show_creators_creatorId_idx" ON "show_creators" USING btree ("creatorId");