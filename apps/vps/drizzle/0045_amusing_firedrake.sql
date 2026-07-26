CREATE TYPE "public"."upload_asset_status" AS ENUM('pending', 'uploaded', 'attached', 'expired');--> statement-breakpoint
CREATE TYPE "public"."upload_asset_type" AS ENUM('image', 'audio');--> statement-breakpoint
CREATE TABLE "upload_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"bucket" text NOT NULL,
	"asset_type" "upload_asset_type" NOT NULL,
	"status" "upload_asset_status" DEFAULT 'pending' NOT NULL,
	"upload_id" text,
	"expected_size" integer,
	"attached_to_table" text,
	"attached_to_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "upload_assets_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "upload_assets" ADD CONSTRAINT "upload_assets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "upload_assets_user_id_idx" ON "upload_assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upload_assets_status_idx" ON "upload_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "upload_assets_expires_at_idx" ON "upload_assets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "upload_assets_attached_to_idx" ON "upload_assets" USING btree ("attached_to_table","attached_to_id");