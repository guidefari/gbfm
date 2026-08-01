import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const drizzleRoot = path.resolve(__dirname, '../../drizzle')

const APPLIED_0043_SQL = `
CREATE TABLE "music_label_albums" (
  "label_id" uuid NOT NULL,
  "album_id" uuid NOT NULL,
  CONSTRAINT "music_label_albums_label_id_album_id_pk" PRIMARY KEY("label_id","album_id")
);
CREATE TABLE "music_label_artists" (
  "label_id" uuid NOT NULL,
  "artist_id" uuid NOT NULL,
  CONSTRAINT "music_label_artists_label_id_artist_id_pk" PRIMARY KEY("label_id","artist_id")
);
ALTER TABLE "music_label_albums" ADD CONSTRAINT "music_label_albums_label_id_music_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."music_labels"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "music_label_albums" ADD CONSTRAINT "music_label_albums_album_id_music_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."music_albums"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "music_label_artists" ADD CONSTRAINT "music_label_artists_label_id_music_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."music_labels"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "music_label_artists" ADD CONSTRAINT "music_label_artists_artist_id_music_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."music_artists"("id") ON DELETE cascade ON UPDATE no action;
`

const APPLIED_0043_AT = 1785026779857

const PRE_0041_SCHEMA = `
CREATE TABLE "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "bio" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "username" text UNIQUE,
  "display_username" text UNIQUE,
  "role" text DEFAULT 'user' NOT NULL,
  "banned" boolean DEFAULT false NOT NULL,
  "ban_reason" text,
  "ban_expires" timestamp
);

CREATE TABLE "labels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "thumbnailUrl" varchar(255),
  "bannerImageUrl" varchar(255),
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

CREATE INDEX "labels_slug_idx" ON "labels" USING btree ("slug");

CREATE TABLE "label_creators" (
  "labelId" uuid NOT NULL REFERENCES "labels"("id"),
  "creatorId" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  CONSTRAINT "label_creators_labelId_creatorId_pk" PRIMARY KEY ("labelId", "creatorId")
);

CREATE TABLE "shows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);

CREATE TABLE "audio" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);

CREATE TABLE "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audio_creators" (
  "audioId" uuid NOT NULL REFERENCES "audio"("id"),
  "creatorId" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  CONSTRAINT "audio_creators_audioId_creatorId_pk" PRIMARY KEY ("audioId", "creatorId")
);

CREATE TABLE "show_creators" (
  "showId" uuid NOT NULL REFERENCES "shows"("id") ON DELETE cascade,
  "creatorId" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  CONSTRAINT "show_creators_showId_creatorId_pk" PRIMARY KEY ("showId", "creatorId")
);

CREATE TABLE "post_creators" (
  "postId" uuid NOT NULL REFERENCES "posts"("id"),
  "creatorId" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  CONSTRAINT "post_creators_postId_creatorId_pk" PRIMARY KEY ("postId", "creatorId")
);

CREATE TABLE "releases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "thumbnailUrl" varchar(255),
  "bannerImageUrl" varchar(255),
  "slug" varchar(255) NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
  "draft" boolean DEFAULT false NOT NULL,
  "tags" varchar(255)[],
  "content" text NOT NULL,
  "labelId" uuid NOT NULL,
  "releaseDate" timestamp with time zone,
  "streamingLinks" jsonb,
  CONSTRAINT "releases_labelId_labels_id_fk" FOREIGN KEY ("labelId") REFERENCES "labels"("id")
);

CREATE INDEX "releases_slug_idx" ON "releases" USING btree ("slug");

CREATE TABLE "music_artists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);

CREATE TABLE "music_albums" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);

CREATE TABLE "music_entity_types" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "displayName" varchar(100) NOT NULL
);

CREATE TABLE "music_platforms" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "displayName" varchar(100) NOT NULL,
  "websiteUrl" varchar(512),
  "iconUrl" varchar(512)
);

CREATE TABLE "music_entity_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entityType" varchar(50) NOT NULL REFERENCES "music_entity_types"("id"),
  "entityId" uuid NOT NULL,
  "platform" varchar(50) NOT NULL REFERENCES "music_platforms"("id"),
  "url" varchar(2048) NOT NULL,
  "status" varchar(50) DEFAULT 'pending_review' NOT NULL,
  "scrapedAt" timestamp with time zone,
  "verifiedAt" timestamp with time zone,
  "verifiedBy" text REFERENCES "user"("id") ON DELETE set null,
  "metadata" jsonb,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "music_entity_links_unique_platform" UNIQUE ("entityType", "entityId", "platform")
);
`

const IDS = {
  userA: 'user-a-creator',
  userB: 'user-b-creator',
  userC: 'user-c-creator',
  published: '11111111-1111-4111-8111-111111111111',
  draft: '22222222-2222-4222-8222-222222222222',
  multiCreator: '33333333-3333-4333-8333-333333333333',
  slugDupEarly: '44444444-4444-4444-8444-444444444444',
  slugDupLate: '55555555-5555-4555-8555-555555555555',
  longSlug: '66666666-6666-4666-8666-666666666666',
  longSlugDup: '77777777-7777-4777-8777-777777777777',
  noCreators: '88888888-8888-4888-8888-888888888888',
  occupiedCandidate: '99999999-9999-4999-8999-999999999991',
  releasePublished: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  releaseMulti: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
} as const

const LONG_SLUG = 'a'.repeat(255)
const LONG_SLUG_PRIMARY_CANDIDATE = `${'a'.repeat(209)}-migrated-${IDS.longSlugDup}`
const EXPECTED_LONG_DUP_SLUG = `migrated-1-${IDS.longSlugDup}`

function migrationSql(tag: string): string {
  return readFileSync(path.join(drizzleRoot, `${tag}.sql`), 'utf8')
}

function splitStatements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

async function applyMigrationSql(pool: Pool, sql: string, createdAt = Date.now()) {
  const hash = createHash('sha256').update(sql).digest('hex')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const statement of splitStatements(sql)) {
      await client.query(statement)
    }
    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)`,
      [hash, createdAt]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function applyMigrationFile(pool: Pool, tag: string) {
  await applyMigrationSql(pool, migrationSql(tag))
}

async function ensureMigrationTable(pool: Pool) {
  await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)
}

async function seedUsers(pool: Pool) {
  for (const [id, name] of [
    [IDS.userA, 'Creator A'],
    [IDS.userB, 'Creator B'],
    [IDS.userC, 'Creator C']
  ] as const) {
    await pool.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, $2, $3, 'user')`, [
      id,
      name,
      `${id}@example.com`
    ])
  }
}

async function seedRepresentativeLabels(pool: Pool) {
  const publishedAt = new Date('2024-01-15T12:00:00.000Z')
  const draftAt = new Date('2024-02-20T08:30:00.000Z')
  const multiAt = new Date('2024-03-10T16:45:00.000Z')
  const dupEarlyAt = new Date('2024-04-01T00:00:00.000Z')
  const dupLateAt = new Date('2024-04-02T00:00:00.000Z')
  const longAt = new Date('2024-05-01T00:00:00.000Z')
  const longDupAt = new Date('2024-05-02T00:00:00.000Z')
  const noCreatorsAt = new Date('2024-06-01T00:00:00.000Z')
  const occupiedAt = new Date('2024-05-01T12:00:00.000Z')

  await pool.query(
    `INSERT INTO "labels" (
      id, title, description, "thumbnailUrl", "bannerImageUrl", slug,
      "createdAt", "updatedAt", draft, tags, content, website, discogs, bandcamp, genres
    ) VALUES
      ($1, 'Published Label', 'Published desc', 'https://img.example/pub.jpg', 'https://img.example/pub-banner.jpg',
       'published-label', $2, $2, false, ARRAY['house','techno'], '# Published MDX',
       'https://published.example', 'https://discogs.com/published', 'https://published.bandcamp.com', ARRAY['electronic']),
      ($3, 'Draft Label', 'Draft desc', NULL, NULL, 'draft-label', $4, $4, true, NULL, '',
       NULL, NULL, NULL, NULL),
      ($5, 'Multi Creator Label', 'Many owners', 'https://img.example/multi.jpg', NULL,
       'multi-creator', $6, $6, false, ARRAY['jazz'], 'multi content',
       'https://multi.example', NULL, 'https://multi.bandcamp.com', ARRAY['jazz']),
      ($7, 'Slug Collision Early', NULL, NULL, NULL, 'dup-slug', $8, $8, false, NULL, 'early',
       NULL, NULL, NULL, NULL),
      ($9, 'Slug Collision Late', NULL, NULL, NULL, 'dup-slug', $10, $10, false, NULL, 'late',
       NULL, NULL, NULL, NULL),
      ($11, 'Long Slug Label', NULL, NULL, NULL, $12, $13, $13, false, NULL, 'long',
       '  https://long.example  ', 'https://discogs.com/long', NULL, NULL),
      ($14, 'Occupied Candidate', NULL, NULL, NULL, $15, $16, $16, false, NULL, 'occupied',
       NULL, NULL, NULL, NULL),
      ($17, 'Long Slug Collision', NULL, NULL, NULL, $12, $18, $18, false, NULL, 'long-dup',
       NULL, NULL, NULL, NULL),
      ($19, 'No Creators Label', NULL, NULL, NULL, 'no-creators', $20, $20, false, NULL, 'solo',
       NULL, NULL, NULL, NULL)
    `,
    [
      IDS.published,
      publishedAt,
      IDS.draft,
      draftAt,
      IDS.multiCreator,
      multiAt,
      IDS.slugDupEarly,
      dupEarlyAt,
      IDS.slugDupLate,
      dupLateAt,
      IDS.longSlug,
      LONG_SLUG,
      longAt,
      IDS.occupiedCandidate,
      LONG_SLUG_PRIMARY_CANDIDATE,
      occupiedAt,
      IDS.longSlugDup,
      longDupAt,
      IDS.noCreators,
      noCreatorsAt
    ]
  )

  await pool.query(
    `INSERT INTO "label_creators" ("labelId", "creatorId") VALUES
      ($1, $2),
      ($3, $4),
      ($3, $5),
      ($3, $6),
      ($7, $2),
      ($8, $4)
    `,
    [
      IDS.published,
      IDS.userB,
      IDS.multiCreator,
      IDS.userC,
      IDS.userA,
      IDS.userB,
      IDS.slugDupEarly,
      IDS.slugDupLate
    ]
  )

  await pool.query(
    `INSERT INTO "releases" (
      id, title, slug, content, "labelId", "createdAt", "updatedAt"
    ) VALUES
      ($1, 'Published Release', 'published-release', 'release body', $2, $3, $3),
      ($4, 'Multi Release', 'multi-release', 'multi release', $5, $6, $6)
    `,
    [IDS.releasePublished, IDS.published, publishedAt, IDS.releaseMulti, IDS.multiCreator, multiAt]
  )
}

describe('label music-entity migrations 0041-0042', () => {
  let container: StartedPostgreSqlContainer
  let pool: Pool

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()
    pool = new Pool({ connectionString: container.getConnectionUri() })
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await container?.stop()
  })

  async function resetToPre0041() {
    await pool.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      DROP SCHEMA IF EXISTS drizzle CASCADE;
    `)
    await pool.query(PRE_0041_SCHEMA)
    await ensureMigrationTable(pool)
    await seedUsers(pool)
  }

  it('migrates representative legacy labels through 0041/0042', async () => {
    await resetToPre0041()
    await seedRepresentativeLabels(pool)

    await applyMigrationFile(pool, '0041_loving_hobgoblin')
    await applyMigrationFile(pool, '0042_sudden_natasha_romanoff')

    const legacyGone = await pool.query(`
      SELECT to_regclass('public.labels') AS labels,
             to_regclass('public.label_creators') AS label_creators
    `)
    expect(legacyGone.rows[0]).toEqual({ labels: null, label_creators: null })

    const labels = await pool.query(`
      SELECT id::text, name, description, image_url, banner_image_url, slug, content,
             tags, genres, published_at, created_by_id, created_at, updated_at
      FROM music_labels
      ORDER BY created_at, id
    `)
    expect(labels.rowCount).toBe(9)

    const byId = Object.fromEntries(labels.rows.map((row) => [row.id, row]))

    expect(byId[IDS.published]).toMatchObject({
      name: 'Published Label',
      description: 'Published desc',
      image_url: 'https://img.example/pub.jpg',
      banner_image_url: 'https://img.example/pub-banner.jpg',
      slug: 'published-label',
      content: '# Published MDX',
      tags: ['house', 'techno'],
      genres: ['electronic'],
      created_by_id: null
    })
    expect(byId[IDS.published].published_at.toISOString()).toBe('2024-01-15T12:00:00.000Z')
    expect(byId[IDS.published].created_at.toISOString()).toBe('2024-01-15T12:00:00.000Z')
    expect(byId[IDS.published].updated_at.toISOString()).toBe('2024-01-15T12:00:00.000Z')

    expect(byId[IDS.draft]).toMatchObject({
      name: 'Draft Label',
      slug: 'draft-label',
      published_at: null,
      created_by_id: null
    })
    expect(byId[IDS.draft].created_at.toISOString()).toBe('2024-02-20T08:30:00.000Z')

    expect(byId[IDS.multiCreator].created_by_id).toBeNull()
    expect(byId[IDS.noCreators].created_by_id).toBeNull()

    expect(byId[IDS.slugDupEarly].slug).toBe('dup-slug')
    expect(byId[IDS.slugDupLate].slug).toBe(`dup-slug-migrated-${IDS.slugDupLate}`)

    expect(byId[IDS.longSlug].slug).toBe(LONG_SLUG)
    expect(byId[IDS.occupiedCandidate].slug).toBe(LONG_SLUG_PRIMARY_CANDIDATE)
    expect(byId[IDS.longSlugDup].slug).toBe(EXPECTED_LONG_DUP_SLUG)
    expect(byId[IDS.longSlugDup].slug.length).toBeLessThanOrEqual(255)
    expect(LONG_SLUG_PRIMARY_CANDIDATE.length).toBe(255)

    const creators = await pool.query(`
      SELECT label_id::text, creator_id
      FROM music_label_creators
      ORDER BY label_id, creator_id
    `)
    expect(creators.rows).toEqual([
      { label_id: IDS.published, creator_id: IDS.userB },
      { label_id: IDS.multiCreator, creator_id: IDS.userA },
      { label_id: IDS.multiCreator, creator_id: IDS.userB },
      { label_id: IDS.multiCreator, creator_id: IDS.userC },
      { label_id: IDS.slugDupEarly, creator_id: IDS.userB },
      { label_id: IDS.slugDupLate, creator_id: IDS.userC }
    ])

    const links = await pool.query(`
      SELECT "entityId"::text AS entity_id, platform, url, status
      FROM music_entity_links
      WHERE "entityType" = 'label'
      ORDER BY "entityId", platform
    `)
    expect(links.rows).toEqual([
      {
        entity_id: IDS.published,
        platform: 'bandcamp',
        url: 'https://published.bandcamp.com',
        status: 'verified'
      },
      {
        entity_id: IDS.published,
        platform: 'discogs',
        url: 'https://discogs.com/published',
        status: 'verified'
      },
      {
        entity_id: IDS.published,
        platform: 'website',
        url: 'https://published.example',
        status: 'verified'
      },
      {
        entity_id: IDS.multiCreator,
        platform: 'bandcamp',
        url: 'https://multi.bandcamp.com',
        status: 'verified'
      },
      {
        entity_id: IDS.multiCreator,
        platform: 'website',
        url: 'https://multi.example',
        status: 'verified'
      },
      {
        entity_id: IDS.longSlug,
        platform: 'discogs',
        url: 'https://discogs.com/long',
        status: 'verified'
      },
      {
        entity_id: IDS.longSlug,
        platform: 'website',
        url: 'https://long.example',
        status: 'verified'
      }
    ])

    const releaseFk = await pool.query(`
      SELECT r.id::text, r."labelId"::text AS label_id, ml.slug
      FROM releases r
      INNER JOIN music_labels ml ON ml.id = r."labelId"
      ORDER BY r.id
    `)
    expect(releaseFk.rows).toEqual([
      {
        id: IDS.releasePublished,
        label_id: IDS.published,
        slug: 'published-label'
      },
      {
        id: IDS.releaseMulti,
        label_id: IDS.multiCreator,
        slug: 'multi-creator'
      }
    ])

    const fkDef = await pool.query(`
      SELECT confrelid::regclass::text AS referenced_table
      FROM pg_constraint
      WHERE conname = 'releases_labelId_music_labels_id_fk'
    `)
    expect(fkDef.rows[0]?.referenced_table).toBe('music_labels')

    const oldFk = await pool.query(`
      SELECT 1 FROM pg_constraint WHERE conname = 'releases_labelId_labels_id_fk'
    `)
    expect(oldFk.rowCount).toBe(0)
  }, 120_000)

  it('rolls back 0042 when an integrity gate fails and keeps legacy tables', async () => {
    await resetToPre0041()
    await seedRepresentativeLabels(pool)
    await applyMigrationFile(pool, '0041_loving_hobgoblin')

    await pool.query(`
      INSERT INTO music_labels (id, name, slug, content)
      VALUES ('99999999-9999-4999-8999-999999999999', 'Poison', 'poison-row', '')
    `)

    await expect(applyMigrationFile(pool, '0042_sudden_natasha_romanoff')).rejects.toThrow(
      /Label migration count mismatch/
    )

    const legacy = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM labels) AS labels,
        (SELECT count(*)::int FROM label_creators) AS creators,
        (SELECT count(*)::int FROM music_labels) AS music_labels,
        (SELECT count(*)::int FROM music_label_creators) AS music_creators,
        to_regclass('public.labels') IS NOT NULL AS labels_exist,
        to_regclass('public.label_creators') IS NOT NULL AS creators_exist
    `)
    expect(legacy.rows[0]).toEqual({
      labels: 9,
      creators: 6,
      music_labels: 1,
      music_creators: 0,
      labels_exist: true,
      creators_exist: true
    })

    const releaseFk = await pool.query(`
      SELECT conname, confrelid::regclass::text AS referenced_table
      FROM pg_constraint
      WHERE conname IN ('releases_labelId_labels_id_fk', 'releases_labelId_music_labels_id_fk')
      ORDER BY conname
    `)
    expect(releaseFk.rows).toEqual([
      { conname: 'releases_labelId_labels_id_fk', referenced_table: 'labels' }
    ])
  }, 120_000)

  it('continues after the originally deployed 0043 affiliation migration', async () => {
    await resetToPre0041()
    await seedRepresentativeLabels(pool)
    await applyMigrationSql(pool, migrationSql('0041_loving_hobgoblin'), 1784994030001)
    await applyMigrationSql(pool, migrationSql('0042_sudden_natasha_romanoff'), 1784994044309)
    await applyMigrationSql(pool, APPLIED_0043_SQL, APPLIED_0043_AT)

    const db = drizzle(pool)
    await expect(
      migratePostgres(db, {
        migrationsFolder: drizzleRoot,
        migrationsTable: '__drizzle_migrations',
        migrationsSchema: 'drizzle'
      })
    ).resolves.toBeUndefined()

    const indexes = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE indexname IN (
        'music_label_artists_artist_id_idx',
        'music_label_albums_album_id_idx'
      )
      ORDER BY indexname
    `)
    expect(indexes.rows).toEqual([
      { indexname: 'music_label_albums_album_id_idx' },
      { indexname: 'music_label_artists_artist_id_idx' }
    ])
  }, 120_000)

  it('applies the label cutover and later affiliations through the drizzle migrator seam', async () => {
    await resetToPre0041()
    await seedRepresentativeLabels(pool)

    // Pre-0041 baseline is hand-built; mark earlier journal entries applied so
    // the production migrator only runs the label cutover migrations.
    await pool.query(
      `INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ('pre-0041-baseline', $1)`,
      [1784844699314]
    )

    const db = drizzle(pool)
    await migratePostgres(db, {
      migrationsFolder: drizzleRoot,
      migrationsTable: '__drizzle_migrations',
      migrationsSchema: 'drizzle'
    })

    const result = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM music_labels) AS labels,
        (SELECT count(*)::int FROM music_label_creators) AS creators,
        (SELECT count(*)::int FROM music_entity_links WHERE "entityType" = 'label') AS links,
        (SELECT count(*)::int FROM music_labels WHERE created_by_id IS NOT NULL) AS with_creator,
        to_regclass('public.labels') AS legacy_labels,
        to_regclass('public.music_label_artists') AS label_artists,
        to_regclass('public.music_label_albums') AS label_albums
    `)
    expect(result.rows[0]).toEqual({
      labels: 9,
      creators: 6,
      links: 7,
      with_creator: 0,
      legacy_labels: null,
      label_artists: 'music_label_artists',
      label_albums: 'music_label_albums'
    })
  }, 120_000)
})
