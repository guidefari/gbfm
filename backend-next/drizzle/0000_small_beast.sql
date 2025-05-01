CREATE TYPE "public"."post_type" AS ENUM('post', 'micro', 'label');--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"username" varchar(255),
	"email" varchar(255) NOT NULL,
	"password" varchar(255),
	"verified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authors_username_unique" UNIQUE("username"),
	CONSTRAINT "authors_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "mixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"thumbnailUrl" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"tags" varchar(255)[],
	"content" text NOT NULL,
	"url" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mixes_to_authors" (
	"mixId" uuid NOT NULL,
	"authorId" uuid NOT NULL,
	CONSTRAINT "mixes_to_authors_mixId_authorId_pk" PRIMARY KEY("mixId","authorId")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"thumbnailUrl" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"tags" varchar(255)[],
	"content" text NOT NULL,
	"type" "post_type",
	"publicationId" uuid
);
--> statement-breakpoint
CREATE TABLE "posts_to_authors" (
	"postId" uuid NOT NULL,
	"authorId" uuid NOT NULL,
	CONSTRAINT "posts_to_authors_postId_authorId_pk" PRIMARY KEY("postId","authorId")
);
--> statement-breakpoint
CREATE TABLE "publication_authors" (
	"publicationId" uuid NOT NULL,
	"authorId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_posts" (
	"publicationId" uuid NOT NULL,
	"postId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	CONSTRAINT "publications_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "mixes_to_authors" ADD CONSTRAINT "mixes_to_authors_mixId_mixes_id_fk" FOREIGN KEY ("mixId") REFERENCES "public"."mixes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mixes_to_authors" ADD CONSTRAINT "mixes_to_authors_authorId_authors_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_publicationId_publications_id_fk" FOREIGN KEY ("publicationId") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_to_authors" ADD CONSTRAINT "posts_to_authors_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_to_authors" ADD CONSTRAINT "posts_to_authors_authorId_authors_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_authors" ADD CONSTRAINT "publication_authors_publicationId_publications_id_fk" FOREIGN KEY ("publicationId") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_authors" ADD CONSTRAINT "publication_authors_authorId_authors_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_posts" ADD CONSTRAINT "publication_posts_publicationId_publications_id_fk" FOREIGN KEY ("publicationId") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_posts" ADD CONSTRAINT "publication_posts_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mixes_slug_idx" ON "mixes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");