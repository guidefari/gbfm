CREATE TABLE "music_entity_resolution_claims" (
	"entity_type" text NOT NULL,
	"canonical_url" text NOT NULL,
	"entity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_entity_resolution_claims_entity_type_canonical_url_pk" PRIMARY KEY("entity_type","canonical_url")
);
--> statement-breakpoint
ALTER TABLE "music_entity_resolution_claims" ADD CONSTRAINT "music_entity_resolution_claims_entity_type_music_entity_types_id_fk" FOREIGN KEY ("entity_type") REFERENCES "public"."music_entity_types"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "music_entity_resolution_claims" (
	"entity_type",
	"canonical_url",
	"entity_id",
	"created_at",
	"updated_at"
)
SELECT DISTINCT ON ("entityType", "url")
	"entityType",
	"url",
	"entityId",
	"createdAt",
	"updatedAt"
FROM "music_entity_links"
ORDER BY "entityType", "url", "createdAt", "id"
ON CONFLICT ("entity_type", "canonical_url") DO NOTHING;
