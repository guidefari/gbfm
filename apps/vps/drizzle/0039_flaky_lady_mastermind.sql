ALTER TABLE "newsletter_subscribers" ADD COLUMN "name" varchar(100);--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN "userId" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audio_type_created_idx" ON "audio" USING btree ("type","createdAt");--> statement-breakpoint
CREATE INDEX "audio_tags_gin_idx" ON "audio" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "favorites_user_created_idx" ON "favorites" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "newsletter_subscribers_userId_idx" ON "newsletter_subscribers" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "posts_type_created_idx" ON "posts" USING btree ("type","createdAt");--> statement-breakpoint
CREATE INDEX "posts_tags_gin_idx" ON "posts" USING gin ("tags");