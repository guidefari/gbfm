CREATE TABLE "music_reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"music_title" text NOT NULL,
	"artist_name" text NOT NULL,
	"music_url" text NOT NULL,
	"album_cover_url" text,
	"reminder_date" timestamp NOT NULL,
	"notes" text,
	"is_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "music_reminder" ADD CONSTRAINT "music_reminder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "music_reminder_user_id_idx" ON "music_reminder" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "music_reminder_reminder_date_idx" ON "music_reminder" USING btree ("reminder_date");--> statement-breakpoint
CREATE INDEX "music_reminder_is_sent_idx" ON "music_reminder" USING btree ("is_sent");