CREATE TABLE "navigation_seen_posts" (
	"sessionId" uuid NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "navigation_sessions" ADD COLUMN "lastIntentToken" text;--> statement-breakpoint
ALTER TABLE "navigation_seen_posts" ADD CONSTRAINT "navigation_seen_posts_sessionId_navigation_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."navigation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "navigation_seen_session_slug_uq" ON "navigation_seen_posts" USING btree ("sessionId","slug");