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

const queryPlan = async (sql: string, bindings: ReadonlyArray<string | number>) =>
  (
    await database
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .bind(...bindings)
      .all<{ readonly detail: string }>()
  ).results.map((row) => row.detail)

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
  test('replays migrations through 0007 and creates every identity table and page index', async () => {
    const result = await database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE (type = 'table' AND (name LIKE 'music_source_%' OR name LIKE 'music_identity_%'))
           OR (type = 'index' AND name IN (
             'music_entity_links_backfill_page_idx',
             'music_entity_resolution_claims_backfill_page_idx',
             'music_identity_maintenance_candidates_source_page_idx',
             'music_source_identities_resolving_audit_page_idx',
             'music_source_identity_conflicts_audit_page_idx'
           ))
         ORDER BY name`
      )
      .all<{ name: string }>()

    expect(result.results.map((row) => row.name)).toEqual([
      'music_entity_links_backfill_page_idx',
      'music_entity_resolution_claims_backfill_page_idx',
      'music_identity_maintenance_actions',
      'music_identity_maintenance_candidates',
      'music_identity_maintenance_candidates_source_page_idx',
      'music_identity_maintenance_findings',
      'music_identity_maintenance_runs',
      'music_identity_maintenance_source_keys',
      'music_source_aliases',
      'music_source_identities',
      'music_source_identities_resolving_audit_page_idx',
      'music_source_identity_conflicts',
      'music_source_identity_conflicts_audit_page_idx'
    ])
  })

  test('uses maintenance pagination and candidate window indexes', async () => {
    const claimPlan = await queryPlan(
      `SELECT entity_type, canonical_url FROM music_entity_resolution_claims
       WHERE entity_id IS NOT NULL AND updated_at > ?
       ORDER BY updated_at, entity_type, canonical_url LIMIT ?`,
      [-1, 25]
    )
    const leasePlan = await queryPlan(
      `SELECT source_key FROM music_source_identities
       WHERE state = 'resolving' AND source_key > ? ORDER BY source_key LIMIT ?`,
      ['', 25]
    )
    const candidatePlan = await queryPlan(
      `SELECT * FROM music_identity_maintenance_candidates
       WHERE generation_id = ? AND source_key = ?
       ORDER BY origin, origin_key LIMIT ?`,
      ['generation', 'source', 101]
    )

    expect(claimPlan.join('\n')).toContain('music_entity_resolution_claims_backfill_page_idx')
    expect(leasePlan.join('\n')).toContain('music_source_identities_resolving_audit_page_idx')
    expect(candidatePlan.join('\n')).toContain(
      'music_identity_maintenance_candidates_source_page_idx'
    )
    expect(candidatePlan.join('\n')).not.toContain('USE TEMP B-TREE FOR ORDER BY')
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
