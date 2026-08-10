ALTER TABLE "email_delivery_logs" DROP CONSTRAINT "email_delivery_logs_userId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user_email_preferences" DROP CONSTRAINT "user_email_preferences_userId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD CONSTRAINT "user_email_preferences_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;