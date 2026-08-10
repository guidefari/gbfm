ALTER TABLE "posts" ADD COLUMN "parent_post_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "root_post_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "depth" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_parent_post_id_posts_id_fk" FOREIGN KEY ("parent_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_root_post_id_posts_id_fk" FOREIGN KEY ("root_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_parent_created_idx" ON "posts" USING btree ("parent_post_id","createdAt");--> statement-breakpoint
CREATE INDEX "posts_root_created_idx" ON "posts" USING btree ("root_post_id","createdAt");