CREATE INDEX "navigation_seen_slug_session_idx" ON "navigation_seen_posts" ("slug","sessionId");--> statement-breakpoint
CREATE INDEX "navigation_trail_session_slug_idx" ON "navigation_trail_entries" ("sessionId","slug");--> statement-breakpoint
CREATE INDEX "navigation_trail_session_post_idx" ON "navigation_trail_entries" ("sessionId","postId");
