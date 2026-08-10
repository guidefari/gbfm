ALTER TABLE "audio_creators" DROP CONSTRAINT "audio_creators_creatorId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "label_creators" DROP CONSTRAINT "label_creators_creatorId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "post_creators" DROP CONSTRAINT "post_creators_creatorId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "audio_creators" ADD CONSTRAINT "audio_creators_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_creators" ADD CONSTRAINT "label_creators_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_creators" ADD CONSTRAINT "post_creators_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;