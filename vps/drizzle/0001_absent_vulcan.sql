CREATE TABLE "author_password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authorId" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "author_password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
DROP INDEX "mixes_slug_idx";--> statement-breakpoint
DROP INDEX "posts_slug_idx";--> statement-breakpoint
ALTER TABLE "author_password_reset_tokens" ADD CONSTRAINT "author_password_reset_tokens_authorId_authors_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mixes_slug_idx" ON "mixes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");