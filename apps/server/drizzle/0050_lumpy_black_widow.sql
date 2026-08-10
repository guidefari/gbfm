CREATE TABLE "navigation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text,
	"deviceToken" text,
	"cursor" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation_trail_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" uuid NOT NULL,
	"postId" uuid NOT NULL,
	"slug" text NOT NULL,
	"position" integer NOT NULL,
	"arrivedBy" text NOT NULL,
	"visitedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "navigation_sessions" ADD CONSTRAINT "navigation_sessions_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_trail_entries" ADD CONSTRAINT "navigation_trail_entries_sessionId_navigation_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."navigation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_trail_entries" ADD CONSTRAINT "navigation_trail_entries_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "navigation_sessions_user_uq" ON "navigation_sessions" USING btree ("userId") WHERE "navigation_sessions"."userId" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "navigation_sessions_device_uq" ON "navigation_sessions" USING btree ("deviceToken") WHERE "navigation_sessions"."deviceToken" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "navigation_trail_session_position_uq" ON "navigation_trail_entries" USING btree ("sessionId","position");