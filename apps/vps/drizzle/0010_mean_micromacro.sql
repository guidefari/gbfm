ALTER TABLE "email_delivery_logs" RENAME COLUMN "authorId" TO "userId";--> statement-breakpoint
ALTER TABLE "email_delivery_logs" DROP CONSTRAINT "email_delivery_logs_authorId_users_id_fk";
--> statement-breakpoint
DROP INDEX "email_delivery_logs_authorId_idx";--> statement-breakpoint
ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_delivery_logs_userId_idx" ON "email_delivery_logs" USING btree ("userId");