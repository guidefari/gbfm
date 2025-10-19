CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"thumbnailUrl" varchar(255),
	"slug" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"tags" varchar(255)[],
	"content" text NOT NULL,
	"labelId" uuid NOT NULL,
	"releaseDate" timestamp with time zone,
	"streamingLinks" jsonb
);
--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_labelId_labels_id_fk" FOREIGN KEY ("labelId") REFERENCES "public"."labels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "releases_slug_idx" ON "releases" USING btree ("slug");