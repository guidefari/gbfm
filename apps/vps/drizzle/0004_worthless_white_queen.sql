ALTER TABLE "audio" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audio" ALTER COLUMN "thumbnailUrl" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mixes" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mixes" ALTER COLUMN "thumbnailUrl" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "thumbnailUrl" DROP NOT NULL;