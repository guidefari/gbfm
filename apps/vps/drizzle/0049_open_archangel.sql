CREATE TYPE "public"."bluesky_source_status" AS ENUM('active', 'edited', 'deleted', 'unavailable', 'error', 'dismissed', 'conflict');--> statement-breakpoint
CREATE TYPE "public"."bluesky_sync_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."external_account_provider" AS ENUM('bluesky');--> statement-breakpoint
CREATE TYPE "public"."external_account_status" AS ENUM('active', 'needs_reconnect', 'revoked', 'error');--> statement-breakpoint
CREATE TABLE "bluesky_post_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_account_id" uuid,
	"post_id" uuid,
	"author_did" text NOT NULL,
	"author_handle" text,
	"at_uri" text NOT NULL,
	"cid" text,
	"public_url" text NOT NULL,
	"source_created_at" timestamp with time zone NOT NULL,
	"source_status" "bluesky_source_status" DEFAULT 'active' NOT NULL,
	"source_fingerprint" text,
	"source_text" text,
	"source_facets" jsonb,
	"source_embeds" jsonb,
	"locally_edited" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bluesky_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_account_id" uuid NOT NULL,
	"status" "bluesky_sync_run_status" DEFAULT 'running' NOT NULL,
	"discovered" integer DEFAULT 0 NOT NULL,
	"qualifying" integer DEFAULT 0 NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"already_imported" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"unresolved" integer DEFAULT 0 NOT NULL,
	"conflicted" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"error_category" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bluesky_sync_states" (
	"external_account_id" uuid PRIMARY KEY NOT NULL,
	"cursor" text,
	"lookback_days" integer DEFAULT 90 NOT NULL,
	"scheduled" boolean DEFAULT false NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"next_eligible_at" timestamp with time zone,
	"last_attempted_at" timestamp with time zone,
	"last_started_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_account_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_account_id" uuid NOT NULL,
	"app_password" jsonb,
	"session" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_account_sessions_external_account_id_unique" UNIQUE("external_account_id")
);
--> statement-breakpoint
CREATE TABLE "external_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" "external_account_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"handle" text,
	"display_name" text,
	"avatar_url" text,
	"issuer" text,
	"service_endpoint" text,
	"status" "external_account_status" DEFAULT 'active' NOT NULL,
	"last_error_category" text,
	"last_successful_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "music_entity_links" ALTER COLUMN "status" SET DEFAULT 'verified';--> statement-breakpoint
ALTER TABLE "bluesky_post_sources" ADD CONSTRAINT "bluesky_post_sources_external_account_id_external_accounts_id_fk" FOREIGN KEY ("external_account_id") REFERENCES "public"."external_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bluesky_post_sources" ADD CONSTRAINT "bluesky_post_sources_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bluesky_sync_runs" ADD CONSTRAINT "bluesky_sync_runs_external_account_id_external_accounts_id_fk" FOREIGN KEY ("external_account_id") REFERENCES "public"."external_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bluesky_sync_states" ADD CONSTRAINT "bluesky_sync_states_external_account_id_external_accounts_id_fk" FOREIGN KEY ("external_account_id") REFERENCES "public"."external_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_account_sessions" ADD CONSTRAINT "external_account_sessions_external_account_id_external_accounts_id_fk" FOREIGN KEY ("external_account_id") REFERENCES "public"."external_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_accounts" ADD CONSTRAINT "external_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bluesky_post_sources_at_uri_idx" ON "bluesky_post_sources" USING btree ("at_uri");--> statement-breakpoint
CREATE INDEX "bluesky_post_sources_account_status_idx" ON "bluesky_post_sources" USING btree ("external_account_id","source_status");--> statement-breakpoint
CREATE INDEX "bluesky_post_sources_post_idx" ON "bluesky_post_sources" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "bluesky_sync_runs_account_started_idx" ON "bluesky_sync_runs" USING btree ("external_account_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_accounts_identity_idx" ON "external_accounts" USING btree ("user_id","provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "external_accounts_owner_idx" ON "external_accounts" USING btree ("user_id","provider","status");