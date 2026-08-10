ALTER TYPE "public"."audio_type" ADD VALUE 'radio_show';--> statement-breakpoint
CREATE TABLE "show_creators" (
	"showId" uuid NOT NULL,
	"creatorId" text NOT NULL,
	CONSTRAINT "show_creators_showId_creatorId_pk" PRIMARY KEY("showId","creatorId")
);
--> statement-breakpoint
CREATE TABLE "show_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"showId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "show_subscriptions_user_show_unique" UNIQUE("userId","showId")
);
--> statement-breakpoint
CREATE TABLE "shows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"thumbnailUrl" varchar(255),
	"slug" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"tags" varchar(255)[],
	"content" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audio" ADD COLUMN "showId" uuid;--> statement-breakpoint
ALTER TABLE "audio" ADD COLUMN "episodeNumber" integer;--> statement-breakpoint
ALTER TABLE "show_creators" ADD CONSTRAINT "show_creators_showId_shows_id_fk" FOREIGN KEY ("showId") REFERENCES "public"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_creators" ADD CONSTRAINT "show_creators_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_subscriptions" ADD CONSTRAINT "show_subscriptions_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_subscriptions" ADD CONSTRAINT "show_subscriptions_showId_shows_id_fk" FOREIGN KEY ("showId") REFERENCES "public"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "show_subscriptions_user_idx" ON "show_subscriptions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "show_subscriptions_show_idx" ON "show_subscriptions" USING btree ("showId");--> statement-breakpoint
CREATE INDEX "shows_slug_idx" ON "shows" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "audio" ADD CONSTRAINT "audio_showId_shows_id_fk" FOREIGN KEY ("showId") REFERENCES "public"."shows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audio_show_idx" ON "audio" USING btree ("showId");