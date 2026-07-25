INSERT INTO "music_entity_types" ("id", "displayName")
VALUES ('label', 'Label')
ON CONFLICT ("id") DO UPDATE SET "displayName" = EXCLUDED."displayName";
--> statement-breakpoint
INSERT INTO "music_platforms" ("id", "displayName", "websiteUrl")
VALUES
  ('website', 'Official Website', NULL),
  ('bandcamp', 'Bandcamp', 'https://bandcamp.com'),
  ('discogs', 'Discogs', 'https://discogs.com')
ON CONFLICT ("id") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "websiteUrl" = EXCLUDED."websiteUrl";
--> statement-breakpoint
CREATE TEMP TABLE label_slug_migration (
  id uuid PRIMARY KEY,
  slug varchar(255) NOT NULL UNIQUE
);
--> statement-breakpoint
WITH ranked_labels AS (
  SELECT
    "id",
    "slug",
    row_number() OVER (PARTITION BY "slug" ORDER BY "createdAt", "id") AS slug_rank
  FROM "labels"
)
INSERT INTO label_slug_migration (id, slug)
SELECT "id", "slug"
FROM ranked_labels
WHERE slug_rank = 1;
--> statement-breakpoint
DO $$
DECLARE
  label record;
  candidate varchar(255);
  attempt integer;
BEGIN
  FOR label IN
    SELECT "id", "slug"
    FROM (
      SELECT
        "id",
        "slug",
        row_number() OVER (PARTITION BY "slug" ORDER BY "createdAt", "id") AS slug_rank
      FROM "labels"
    ) ranked_labels
    WHERE slug_rank > 1
    ORDER BY "slug", "id"
  LOOP
    candidate := left(label."slug", 209) || '-migrated-' || label."id"::text;
    attempt := 1;
    WHILE EXISTS (SELECT 1 FROM label_slug_migration WHERE slug = candidate) LOOP
      candidate := 'migrated-' || attempt || '-' || label."id"::text;
      attempt := attempt + 1;
    END LOOP;
    INSERT INTO label_slug_migration (id, slug) VALUES (label."id", candidate);
  END LOOP;
END $$;
--> statement-breakpoint
INSERT INTO "music_labels" (
  "id",
  "name",
  "description",
  "image_url",
  "banner_image_url",
  "slug",
  "content",
  "tags",
  "genres",
  "published_at",
  "created_by_id",
  "created_at",
  "updated_at"
)
SELECT
  label."id",
  label."title",
  label."description",
  label."thumbnailUrl",
  label."bannerImageUrl",
  migrated_slug.slug,
  label."content",
  label."tags",
  label."genres",
  CASE WHEN label."draft" THEN NULL ELSE label."createdAt" END,
  creator."creatorId",
  label."createdAt",
  label."updatedAt"
FROM "labels" label
INNER JOIN label_slug_migration migrated_slug ON migrated_slug.id = label."id"
LEFT JOIN LATERAL (
  SELECT "creatorId"
  FROM "label_creators"
  WHERE "labelId" = label."id"
  ORDER BY "creatorId"
  LIMIT 1
) creator ON true;
--> statement-breakpoint
DROP TABLE label_slug_migration;
--> statement-breakpoint
INSERT INTO "music_label_creators" ("label_id", "creator_id")
SELECT "labelId", "creatorId"
FROM "label_creators";
--> statement-breakpoint
INSERT INTO "music_entity_links" (
  "entityType",
  "entityId",
  "platform",
  "url",
  "status",
  "verifiedAt",
  "createdAt",
  "updatedAt"
)
SELECT 'label', "id", 'website', trim("website"), 'verified', "updatedAt", "createdAt", "updatedAt"
FROM "labels"
WHERE nullif(trim("website"), '') IS NOT NULL
UNION ALL
SELECT 'label', "id", 'bandcamp', trim("bandcamp"), 'verified', "updatedAt", "createdAt", "updatedAt"
FROM "labels"
WHERE nullif(trim("bandcamp"), '') IS NOT NULL
UNION ALL
SELECT 'label', "id", 'discogs', trim("discogs"), 'verified', "updatedAt", "createdAt", "updatedAt"
FROM "labels"
WHERE nullif(trim("discogs"), '') IS NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF (SELECT count(*) FROM "labels") <> (SELECT count(*) FROM "music_labels") THEN
    RAISE EXCEPTION 'Label migration count mismatch';
  END IF;
  IF (SELECT count(*) FROM "label_creators") <> (SELECT count(*) FROM "music_label_creators") THEN
    RAISE EXCEPTION 'Label creator migration count mismatch';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "releases"
    LEFT JOIN "music_labels" ON "music_labels"."id" = "releases"."labelId"
    WHERE "music_labels"."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'A release has no migrated music label';
  END IF;
  IF (
    SELECT count(*)
    FROM "labels", LATERAL (VALUES ("website"), ("bandcamp"), ("discogs")) links(url)
    WHERE nullif(trim(links.url), '') IS NOT NULL
  ) <> (
    SELECT count(*)
    FROM "music_entity_links"
    WHERE "entityType" = 'label'
  ) THEN
    RAISE EXCEPTION 'Label link migration count mismatch';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "releases" DROP CONSTRAINT "releases_labelId_labels_id_fk";
--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_labelId_music_labels_id_fk" FOREIGN KEY ("labelId") REFERENCES "public"."music_labels"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
DROP TABLE "label_creators";
--> statement-breakpoint
DROP TABLE "labels";
