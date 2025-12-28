DROP TABLE "permissions" CASCADE;--> statement-breakpoint
DROP TABLE "role_permissions" CASCADE;--> statement-breakpoint
DROP TABLE "roles" CASCADE;--> statement-breakpoint
DROP TABLE "user_permissions" CASCADE;--> statement-breakpoint
DROP TABLE "user_roles" CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_expires" timestamp;