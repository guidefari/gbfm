ALTER TABLE "newsletter_subscribers" ADD COLUMN "unsubscribeToken" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN "unsubscribedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_unsubscribeToken_unique" UNIQUE("unsubscribeToken");