CREATE TABLE "labels" (
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
	"website" varchar(255),
	"discogs" varchar(255),
	"bandcamp" varchar(255),
	"genres" varchar(255)[]
);
--> statement-breakpoint
CREATE TABLE "labels_to_authors" (
	"labelId" uuid NOT NULL,
	"authorId" uuid NOT NULL,
	CONSTRAINT "labels_to_authors_labelId_authorId_pk" PRIMARY KEY("labelId","authorId")
);
--> statement-breakpoint
ALTER TABLE "labels_to_authors" ADD CONSTRAINT "labels_to_authors_labelId_labels_id_fk" FOREIGN KEY ("labelId") REFERENCES "public"."labels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels_to_authors" ADD CONSTRAINT "labels_to_authors_authorId_authors_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "labels_slug_idx" ON "labels" USING btree ("slug");