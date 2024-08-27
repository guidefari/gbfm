CREATE TABLE IF NOT EXISTS "mixes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"date" date NOT NULL,
	"mp3_url" varchar(255) NOT NULL,
	"thumbnail_url" varchar(255),
	"youtube_id" varchar(50),
	"author" varchar(100),
	"genres" text,
	"url" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
