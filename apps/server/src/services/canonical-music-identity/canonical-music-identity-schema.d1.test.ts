import type { D1Database } from '@cloudflare/workers-types'
import { drizzle } from 'drizzle-orm/d1'
import { beforeAll, describe, expect, test } from 'vitest'
import {
  musicSourceAliasesTable,
  musicSourceIdentitiesTable,
  musicSourceIdentityConflictsTable
} from '@/db/music-entity.schema'
import { createMigratedD1Database } from '@/test/migrate-d1'

let database: D1Database

beforeAll(async () => {
  database = await createMigratedD1Database()
  await database.batch([
    database
      .prepare('INSERT INTO music_platforms (id, displayName) VALUES (?, ?)')
      .bind('spotify', 'Spotify'),
    database
      .prepare('INSERT INTO music_entity_types (id, displayName) VALUES (?, ?)')
      .bind('album', 'Album'),
    database
      .prepare('INSERT INTO music_entity_types (id, displayName) VALUES (?, ?)')
      .bind('track', 'Track')
  ])
})

const insertResolvedIdentity = (
  sourceKey: string,
  canonicalUrl: string,
  externalId: string | null
) =>
  database
    .prepare(
      `INSERT INTO music_source_identities (
        source_key, platform, source_entity_type, external_id, canonical_url, state,
        entity_type, entity_id, resolved_at, created_at, updated_at
      ) VALUES (?, 'spotify', 'album', ?, ?, 'resolved', 'album', ?, 1000, 1000, 1000)`
    )
    .bind(sourceKey, externalId, canonicalUrl, `entity-${sourceKey}`)
    .run()

describe('canonical music identity D1 migration', () => {
  test('replays migrations through 0006 and creates every identity table', async () => {
    const result = await database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name LIKE 'music_source_%'
         ORDER BY name`
      )
      .all<{ name: string }>()

    expect(result.results.map((row) => row.name)).toEqual([
      'music_source_aliases',
      'music_source_identities',
      'music_source_identity_conflicts'
    ])
  })

  test('round-trips identity values through the Drizzle schema', async () => {
    const db = drizzle(database, {
      schema: {
        musicSourceAliasesTable,
        musicSourceIdentitiesTable,
        musicSourceIdentityConflictsTable
      }
    })
    const createdAt = new Date('2026-08-15T12:00:00.000Z')
    await db.insert(musicSourceIdentitiesTable).values({
      sourceKey: 'spotify:album:drizzle',
      platform: 'spotify',
      sourceEntityType: 'album',
      externalId: 'drizzle',
      canonicalUrl: 'https://open.spotify.com/album/drizzle',
      state: 'resolved',
      entityType: 'album',
      entityId: 'entity-drizzle',
      resolvedAt: createdAt,
      createdAt,
      updatedAt: createdAt
    })

    const row = await db.query.musicSourceIdentitiesTable.findFirst({
      where: (identity, { eq }) => eq(identity.sourceKey, 'spotify:album:drizzle')
    })

    expect(row).toMatchObject({
      state: 'resolved',
      resolvedAt: createdAt,
      createdAt,
      updatedAt: createdAt
    })
  })

  test('enforces legal resolving and resolved identity states', async () => {
    await expect(
      database
        .prepare(
          `INSERT INTO music_source_identities (
            source_key, platform, source_entity_type, canonical_url, state,
            owner_token, lease_expires_at, created_at, updated_at
          ) VALUES ('spotify:album:resolving', 'spotify', 'album',
            'https://open.spotify.com/album/resolving', 'resolving', 'owner', 2000, 1000, 1000)`
        )
        .run()
    ).resolves.toMatchObject({ success: true })

    await expect(
      database
        .prepare(
          `INSERT INTO music_source_identities (
            source_key, platform, source_entity_type, canonical_url, state,
            entity_type, entity_id, owner_token, lease_expires_at, resolved_at,
            created_at, updated_at
          ) VALUES ('spotify:album:invalid', 'spotify', 'album',
            'https://open.spotify.com/album/invalid', 'resolved', 'album', 'entity-invalid',
            'stale-owner', 2000, 1000, 1000, 1000)`
        )
        .run()
    ).rejects.toThrow()
  })

  test('enforces canonical URL and provider identity uniqueness', async () => {
    await insertResolvedIdentity(
      'spotify:album:unique-a',
      'https://open.spotify.com/album/unique-a',
      'provider-unique'
    )

    await expect(
      insertResolvedIdentity(
        'spotify:album:unique-b',
        'https://open.spotify.com/album/unique-b',
        'provider-unique'
      )
    ).rejects.toThrow()
    await expect(
      insertResolvedIdentity(
        'spotify:album:unique-c',
        'https://open.spotify.com/album/unique-a',
        'provider-other'
      )
    ).rejects.toThrow()
  })

  test('cascades aliases and conflicts when an identity is removed', async () => {
    await insertResolvedIdentity(
      'spotify:album:cascade',
      'https://open.spotify.com/album/cascade',
      'cascade'
    )
    await database.batch([
      database
        .prepare(
          `INSERT INTO music_source_aliases
           (normalized_url, source_key, first_seen_at, last_seen_at)
           VALUES (?, ?, 1000, 1000)`
        )
        .bind('https://play.spotify.com/album/cascade', 'spotify:album:cascade'),
      database.prepare(
        `INSERT INTO music_source_identity_conflicts (
            id, source_key, incumbent_entity_type, incumbent_entity_id,
            candidate_entity_type, candidate_entity_id, reason, status, detected_at
          ) VALUES ('conflict-cascade', 'spotify:album:cascade', 'album', 'incumbent',
            'album', 'candidate', 'ownership_mismatch', 'open', 1000)`
      )
    ])

    await database
      .prepare("DELETE FROM music_source_identities WHERE source_key = 'spotify:album:cascade'")
      .run()

    const aliases = await database
      .prepare("SELECT * FROM music_source_aliases WHERE source_key = 'spotify:album:cascade'")
      .all()
    const conflicts = await database
      .prepare(
        "SELECT * FROM music_source_identity_conflicts WHERE source_key = 'spotify:album:cascade'"
      )
      .all()
    expect(aliases.results).toHaveLength(0)
    expect(conflicts.results).toHaveLength(0)
  })

  test('allows only one open report for the same identity and entity pair', async () => {
    await insertResolvedIdentity(
      'spotify:album:conflict',
      'https://open.spotify.com/album/conflict',
      'conflict'
    )
    const insertConflict = (id: string) =>
      database
        .prepare(
          `INSERT INTO music_source_identity_conflicts (
            id, source_key, incumbent_entity_type, incumbent_entity_id,
            candidate_entity_type, candidate_entity_id, reason, status, detected_at
          ) VALUES (?, 'spotify:album:conflict', 'album', 'incumbent',
            'album', 'candidate', 'ownership_mismatch', 'open', 1000)`
        )
        .bind(id)
        .run()

    await expect(insertConflict('conflict-open-1')).resolves.toMatchObject({ success: true })
    await expect(insertConflict('conflict-open-2')).rejects.toThrow()
    await database
      .prepare(
        "UPDATE music_source_identity_conflicts SET status = 'resolved', resolved_at = 2000 WHERE id = 'conflict-open-1'"
      )
      .run()
    await expect(insertConflict('conflict-open-2')).resolves.toMatchObject({ success: true })
  })
})
