ALTER TABLE "audio_creators" DROP CONSTRAINT "audio_creators_creatorId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "email_delivery_logs" DROP CONSTRAINT "email_delivery_logs_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_email_preferences" DROP CONSTRAINT "user_email_preferences_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "label_creators" DROP CONSTRAINT "label_creators_creatorId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "mix_creators" DROP CONSTRAINT "mix_creators_creatorId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "post_creators" DROP CONSTRAINT "post_creators_creatorId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "publication_members" DROP CONSTRAINT "publication_members_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_grantedBy_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_assignedBy_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audio_creators" ALTER COLUMN "creatorId" SET DATA TYPE text USING "creatorId"::text;--> statement-breakpoint
ALTER TABLE "email_delivery_logs" ALTER COLUMN "userId" SET DATA TYPE text USING "userId"::text;--> statement-breakpoint
ALTER TABLE "user_email_preferences" ALTER COLUMN "userId" SET DATA TYPE text USING "userId"::text;--> statement-breakpoint
ALTER TABLE "label_creators" ALTER COLUMN "creatorId" SET DATA TYPE text USING "creatorId"::text;--> statement-breakpoint
ALTER TABLE "mix_creators" ALTER COLUMN "creatorId" SET DATA TYPE text USING "creatorId"::text;--> statement-breakpoint
ALTER TABLE "post_creators" ALTER COLUMN "creatorId" SET DATA TYPE text USING "creatorId"::text;--> statement-breakpoint
ALTER TABLE "publication_members" ALTER COLUMN "userId" SET DATA TYPE text USING "userId"::text;--> statement-breakpoint
ALTER TABLE "user_permissions" ALTER COLUMN "userId" SET DATA TYPE text USING "userId"::text;--> statement-breakpoint
ALTER TABLE "user_permissions" ALTER COLUMN "grantedBy" SET DATA TYPE text USING "grantedBy"::text;--> statement-breakpoint
ALTER TABLE "user_roles" ALTER COLUMN "userId" SET DATA TYPE text USING "userId"::text;--> statement-breakpoint
ALTER TABLE "user_roles" ALTER COLUMN "assignedBy" SET DATA TYPE text USING "assignedBy"::text;--> statement-breakpoint
ALTER TABLE "audio_creators" ADD CONSTRAINT "audio_creators_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD CONSTRAINT "user_email_preferences_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_creators" ADD CONSTRAINT "label_creators_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mix_creators" ADD CONSTRAINT "mix_creators_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_creators" ADD CONSTRAINT "post_creators_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_members" ADD CONSTRAINT "publication_members_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_grantedBy_user_id_fk" FOREIGN KEY ("grantedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assignedBy_user_id_fk" FOREIGN KEY ("assignedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;