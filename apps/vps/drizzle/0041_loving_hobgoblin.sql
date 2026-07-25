CREATE TABLE "music_label_creators" (
	"label_id" uuid NOT NULL,
	"creator_id" text NOT NULL,
	CONSTRAINT "music_label_creators_label_id_creator_id_pk" PRIMARY KEY("label_id","creator_id")
);
--> statement-breakpoint
CREATE TABLE "music_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"image_url" varchar(512),
	"banner_image_url" varchar(512),
	"slug" varchar(255) NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"tags" varchar(255)[],
	"genres" varchar(255)[],
	"published_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_labels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "music_label_creators" ADD CONSTRAINT "music_label_creators_label_id_music_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."music_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_label_creators" ADD CONSTRAINT "music_label_creators_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_labels" ADD CONSTRAINT "music_labels_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "music_labels_slug_idx" ON "music_labels" USING btree ("slug");