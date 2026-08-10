ALTER TABLE IF EXISTS "publication_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "publication_posts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "publications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "publication_members" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "publication_posts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "publications" CASCADE;--> statement-breakpoint
ALTER TABLE IF EXISTS "posts" DROP CONSTRAINT IF EXISTS "posts_publicationId_publications_id_fk";
--> statement-breakpoint
ALTER TABLE IF EXISTS "posts" DROP COLUMN IF EXISTS "publicationId";
