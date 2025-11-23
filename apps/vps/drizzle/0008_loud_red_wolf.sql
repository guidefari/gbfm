CREATE TYPE "public"."email_delivery_status" AS ENUM('PENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."email_notification_type" AS ENUM('TRANSACTIONAL', 'MIX_RELEASE', 'PROMOTIONAL', 'SYSTEM');--> statement-breakpoint
CREATE TABLE "author_email_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authorId" uuid NOT NULL,
	"mixReleaseEnabled" boolean DEFAULT true NOT NULL,
	"promotionalEnabled" boolean DEFAULT true NOT NULL,
	"systemEnabled" boolean DEFAULT true NOT NULL,
	"globalUnsubscribe" boolean DEFAULT false NOT NULL,
	"unsubscribeToken" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "author_email_preferences_authorId_unique" UNIQUE("authorId"),
	CONSTRAINT "author_email_preferences_unsubscribeToken_unique" UNIQUE("unsubscribeToken")
);
--> statement-breakpoint
CREATE TABLE "email_delivery_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authorId" uuid,
	"recipientEmail" varchar(255) NOT NULL,
	"recipientName" varchar(255),
	"email_type" "email_notification_type" NOT NULL,
	"templateName" varchar(100) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"status" "email_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"sesMessageId" varchar(255),
	"metadata" jsonb,
	"errorMessage" text,
	"sentAt" timestamp with time zone,
	"deliveredAt" timestamp with time zone,
	"bouncedAt" timestamp with time zone,
	"complainedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "author_email_preferences" ADD CONSTRAINT "author_email_preferences_authorId_authors_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_authorId_authors_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_delivery_logs_authorId_idx" ON "email_delivery_logs" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "email_delivery_logs_recipientEmail_idx" ON "email_delivery_logs" USING btree ("recipientEmail");--> statement-breakpoint
CREATE INDEX "email_delivery_logs_status_idx" ON "email_delivery_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_delivery_logs_createdAt_idx" ON "email_delivery_logs" USING btree ("createdAt");