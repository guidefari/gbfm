ALTER TABLE "favorites" ALTER COLUMN "audio_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "favorites" ADD COLUMN "show_id" uuid;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "unique_user_show" UNIQUE("user_id","show_id");