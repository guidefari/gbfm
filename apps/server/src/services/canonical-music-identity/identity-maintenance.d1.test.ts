import type { D1Database } from '@cloudflare/workers-types'
import { drizzle } from 'drizzle-orm/d1'
import { Effect } from 'effect'
import { Miniflare } from 'miniflare'
import { beforeEach, describe, expect, test } from 'vitest'
import * as schema from '@/db/exports'
import type { DatabaseClient } from '@/db/layer'
import { createMigratedD1Database } from '@/test/migrate-d1'
import { MusicIdentityStorageError } from './errors'
import {
  auditMusicIdentities,
  runIdentityBackfillBatch,
  type IdentityBackfillSummary
} from './identity-maintenance'

let database: D1Database
let db: DatabaseClient

const run = <A>(effect: Effect.Effect<A, MusicIdentityStorageError>) => Effect.runPromise(effect)

const insertEntity = async (type: 'album' | 'track', id: string) => {
  const table = type === 'album' ? 'music_albums' : 'music_tracks'
  await database
    .prepare(
      `INSERT INTO ${table} (id, title, slug, createdAt, updatedAt)
       VALUES (?, ?, ?, 1000, 1000)`
    )
    .bind(id, id, `${type}-${id}`)
    .run()
}

const insertLink = async (input: {
  readonly id: string
  readonly entityType: 'album' | 'track'
  readonly entityId: string
  readonly url: string
  readonly status?: string
  readonly createdAt?: number
  readonly verifiedAt?: number | null
}) => {
  await database
    .prepare(
      `INSERT INTO music_entity_links (
         id, entity_type, entityId, platform, url, status, verifiedAt, createdAt, updatedAt
       ) VALUES (?, ?, ?, 'spotify', ?, ?, ?, ?, ?)`
    )
    .bind(
      input.id,
      input.entityType,
      input.entityId,
      input.url,
      input.status ?? 'verified',
      input.verifiedAt ?? null,
      input.createdAt ?? 1000,
      input.createdAt ?? 1000
    )
    .run()
}

const tableCount = async (table: string) => {
  const row = await database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<{
    readonly count: number
  }>()
  return row?.count ?? 0
}

const applyToCompletion = async (batchSize = 10) => {
  let summary: IdentityBackfillSummary | undefined
  for (let invocation = 0; invocation < 20; invocation += 1) {
    summary = await run(
      runIdentityBackfillBatch(db, {
        apply: true,
        batchSize,
        generationId: summary?.generationId ?? undefined,
        now: new Date(5000 + invocation)
      })
    )
    if (summary.complete) return summary
  }
  throw new Error('Maintenance run did not complete')
}

beforeEach(async () => {
  database = await createMigratedD1Database()
  db = drizzle(database, { schema })
  await database.batch([
    database
      .prepare('INSERT INTO music_entity_types (id, displayName) VALUES (?, ?)')
      .bind('album', 'Album'),
    database
      .prepare('INSERT INTO music_entity_types (id, displayName) VALUES (?, ?)')
      .bind('track', 'Track'),
    database
      .prepare('INSERT INTO music_platforms (id, displayName) VALUES (?, ?)')
      .bind('spotify', 'Spotify')
  ])
})

describe('identity maintenance', () => {
  test('keeps the default preview immutable', async () => {
    await insertEntity('album', 'album-dry')
    await insertLink({
      id: 'link-dry',
      entityType: 'album',
      entityId: 'album-dry',
      url: 'https://open.spotify.com/album/DryRun1?si=share'
    })

    const summary = await run(runIdentityBackfillBatch(db))

    expect(summary).toMatchObject({
      dryRun: true,
      phase: 'preview',
      scanned: 1,
      candidates: 1,
      proposed: 1,
      identitiesCreated: 0
    })
    expect(await tableCount('music_identity_maintenance_runs')).toBe(0)
    expect(await tableCount('music_source_identities')).toBe(0)
  })

  test('stages once and resumes a stable generation after interruption', async () => {
    await insertEntity('album', 'resume-a')
    await insertEntity('album', 'resume-b')
    await insertLink({
      id: 'a',
      entityType: 'album',
      entityId: 'resume-a',
      url: 'https://open.spotify.com/album/ResumeA'
    })
    await insertLink({
      id: 'b',
      entityType: 'album',
      entityId: 'resume-b',
      url: 'https://open.spotify.com/album/ResumeB',
      createdAt: 2000
    })

    const first = await run(runIdentityBackfillBatch(db, { apply: true, batchSize: 1 }))
    const resumed = await run(
      runIdentityBackfillBatch(db, {
        apply: true,
        batchSize: 1,
        generationId: first.generationId ?? undefined
      })
    )

    expect(first.generationId).toBeTruthy()
    expect(resumed.generationId).toBe(first.generationId)
    expect(resumed.scanned).toBe(2)
    expect(await tableCount('music_identity_maintenance_candidates')).toBe(2)
    expect(await tableCount('music_source_identities')).toBe(0)

    const completed = await applyToCompletion(1)
    expect(completed.identitiesCreated).toBe(2)
    expect(await tableCount('music_source_identities')).toBe(2)
  })

  test('rolls back an interrupted apply page and replays it with truthful counts', async () => {
    await insertEntity('album', 'interrupted')
    await insertLink({
      id: 'interrupted-link',
      entityType: 'album',
      entityId: 'interrupted',
      url: 'https://open.spotify.com/album/Interrupted'
    })

    let summary = await run(runIdentityBackfillBatch(db, { apply: true }))
    summary = await run(
      runIdentityBackfillBatch(db, {
        apply: true,
        generationId: summary.generationId ?? undefined
      })
    )
    expect(summary.phase).toBe('apply')
    await database
      .prepare(
        `CREATE TRIGGER interrupt_alias_insert BEFORE INSERT ON music_source_aliases
         BEGIN SELECT RAISE(ABORT, 'interrupted apply'); END`
      )
      .run()

    await expect(
      run(
        runIdentityBackfillBatch(db, {
          apply: true,
          generationId: summary.generationId ?? undefined
        })
      )
    ).rejects.toThrow('interrupted apply')
    expect(await tableCount('music_source_identities')).toBe(0)
    expect(await tableCount('music_identity_maintenance_actions')).toBe(0)
    const interruptedRun = await database
      .prepare(
        `SELECT apply_cursor_source_key AS cursor FROM music_identity_maintenance_runs
         WHERE generation_id = ?`
      )
      .bind(summary.generationId)
      .first<{ readonly cursor: string }>()
    expect(interruptedRun?.cursor).toBe('')

    await database.prepare('DROP TRIGGER interrupt_alias_insert').run()
    const completed = await applyToCompletion()
    expect(completed).toMatchObject({ identitiesCreated: 1, aliasesCreated: 1 })
  })

  test('ranks collisions globally when owners occur on different scan pages', async () => {
    await insertEntity('album', 'unverified')
    await insertEntity('album', 'verified')
    await insertLink({
      id: 'first',
      entityType: 'album',
      entityId: 'unverified',
      url: 'https://open.spotify.com/album/CrossPage',
      status: 'pending',
      createdAt: 1000
    })
    await insertLink({
      id: 'second',
      entityType: 'album',
      entityId: 'verified',
      url: 'https://open.spotify.com/album/CrossPage?si=second',
      status: 'verified',
      verifiedAt: 2000,
      createdAt: 2000
    })

    const summary = await applyToCompletion(1)
    const identity = await database
      .prepare(
        "SELECT entity_id AS entityId FROM music_source_identities WHERE source_key = 'spotify:album:CrossPage'"
      )
      .first<{ readonly entityId: string }>()

    expect(identity?.entityId).toBe('verified')
    expect(summary.detected).toBe(1)
    expect(await tableCount('music_source_identity_conflicts')).toBe(1)
  })

  test('ranks eligible owners with current live link status and timestamps', async () => {
    await insertEntity('album', 'stale-winner')
    await insertEntity('album', 'live-winner')
    await insertLink({
      id: 'stale-winner-link',
      entityType: 'album',
      entityId: 'stale-winner',
      url: 'https://open.spotify.com/album/LiveRanking?si=stale',
      status: 'verified',
      verifiedAt: 1000,
      createdAt: 1000
    })
    await insertLink({
      id: 'live-winner-link',
      entityType: 'album',
      entityId: 'live-winner',
      url: 'https://open.spotify.com/album/LiveRanking?si=live',
      status: 'pending',
      createdAt: 2000
    })

    let summary = await run(runIdentityBackfillBatch(db, { apply: true, batchSize: 10 }))
    summary = await run(
      runIdentityBackfillBatch(db, {
        apply: true,
        batchSize: 10,
        generationId: summary.generationId ?? undefined
      })
    )
    expect(summary.phase).toBe('apply')

    await database.batch([
      database.prepare(
        `UPDATE music_entity_links SET status = 'pending', verifiedAt = NULL,
             scrapedAt = 4000, createdAt = 4000 WHERE id = 'stale-winner-link'`
      ),
      database.prepare(
        `UPDATE music_entity_links SET status = 'verified', verifiedAt = 3000,
             scrapedAt = 3000, createdAt = 3000 WHERE id = 'live-winner-link'`
      )
    ])

    const completed = await applyToCompletion(10)
    const identity = await database
      .prepare(
        "SELECT entity_id AS entityId FROM music_source_identities WHERE source_key = 'spotify:album:LiveRanking'"
      )
      .first<{ readonly entityId: string }>()

    expect(completed.generationId).toBe(summary.generationId)
    expect(identity?.entityId).toBe('live-winner')
  })

  test('persists canonical-field and alias collision classes without conflict foreign keys', async () => {
    await insertEntity('album', 'unique-candidate')
    await insertEntity('album', 'alias-candidate')
    await insertEntity('album', 'incumbent')
    await insertLink({
      id: 'unique-candidate-link',
      entityType: 'album',
      entityId: 'unique-candidate',
      url: 'https://open.spotify.com/album/UniqueCollision'
    })
    await insertLink({
      id: 'alias-candidate-link',
      entityType: 'album',
      entityId: 'alias-candidate',
      url: 'https://open.spotify.com/album/AliasCollision',
      createdAt: 2000
    })
    await database
      .prepare(
        `INSERT INTO music_source_identities (
           source_key, platform, source_entity_type, external_id, canonical_url, state,
           entity_type, entity_id, resolved_at, created_at, updated_at
         ) VALUES
           ('manual:unique', 'spotify', 'album', 'UniqueCollision',
             'https://open.spotify.com/album/UniqueCollision', 'resolved',
             'album', 'incumbent', 1, 1, 1),
           ('spotify:album:AliasOwner', 'spotify', 'album', 'AliasOwner',
             'https://open.spotify.com/album/AliasOwner', 'resolved',
             'album', 'incumbent', 1, 1, 1)`
      )
      .run()
    await database
      .prepare(
        `INSERT INTO music_source_aliases (normalized_url, source_key, first_seen_at, last_seen_at)
         VALUES ('https://open.spotify.com/album/AliasCollision', 'spotify:album:AliasOwner', 1, 1)`
      )
      .run()

    const summary = await applyToCompletion()
    const findingKeys = (
      await database
        .prepare(
          `SELECT finding_key AS findingKey FROM music_identity_maintenance_findings
           WHERE generation_id = ? ORDER BY finding_key`
        )
        .bind(summary.generationId)
        .all<{ readonly findingKey: string }>()
    ).results.map((row) => row.findingKey)

    expect(findingKeys).toEqual([
      'alias:https://open.spotify.com/album/AliasCollision',
      'unique:spotify:album:UniqueCollision'
    ])
    expect(summary.identitiesCreated).toBe(1)
  })

  test('counts only conflict categories in mixed backfill findings', async () => {
    await insertEntity('album', 'mixed-candidate')
    await insertEntity('album', 'mixed-invalid-owner')
    await insertEntity('album', 'mixed-incumbent')
    await insertLink({
      id: 'mixed-collision',
      entityType: 'album',
      entityId: 'mixed-candidate',
      url: 'https://open.spotify.com/album/MixedCollision'
    })
    await insertLink({
      id: 'mixed-invalid',
      entityType: 'album',
      entityId: 'mixed-invalid-owner',
      url: 'https://open.spotify.com/track/WrongType',
      createdAt: 2000
    })
    await database
      .prepare(
        `INSERT INTO music_source_identities (
           source_key, platform, source_entity_type, external_id, canonical_url, state,
           entity_type, entity_id, resolved_at, created_at, updated_at
         ) VALUES ('manual:mixed', 'spotify', 'album', 'MixedCollision',
           'https://open.spotify.com/album/MixedCollision', 'resolved',
           'album', 'mixed-incumbent', 1, 1, 1)`
      )
      .run()

    const summary = await applyToCompletion()

    expect(summary).toMatchObject({ detected: 2, conflicted: 1, invalid: 1 })
    expect(summary.issues.map((issue) => issue.category).sort()).toEqual([
      'collision',
      'mismatched_entity_type'
    ])
  })

  test('imports compatible completed claims but lets links win', async () => {
    await insertEntity('album', 'claim-owner')
    await insertEntity('album', 'link-owner')
    await database
      .prepare(
        `INSERT INTO music_entity_resolution_claims (
           entity_type, canonical_url, entity_id, created_at, updated_at
         ) VALUES ('album', 'https://open.spotify.com/album/ClaimOnly', 'claim-owner', 500, 500),
           ('album', 'https://open.spotify.com/album/Shared', 'claim-owner', 500, 500)`
      )
      .run()
    await insertLink({
      id: 'shared-link',
      entityType: 'album',
      entityId: 'link-owner',
      url: 'https://open.spotify.com/album/Shared',
      createdAt: 1000
    })

    await applyToCompletion(10)
    const rows = (
      await database
        .prepare(
          `SELECT source_key AS sourceKey, entity_id AS entityId FROM music_source_identities
           ORDER BY source_key`
        )
        .all<{ readonly sourceKey: string; readonly entityId: string }>()
    ).results

    expect(rows).toEqual([
      { sourceKey: 'spotify:album:ClaimOnly', entityId: 'claim-owner' },
      { sourceKey: 'spotify:album:Shared', entityId: 'link-owner' }
    ])
  })

  test('does not resurrect a staged owner after its live link is released', async () => {
    await insertEntity('album', 'released')
    await insertLink({
      id: 'released-link',
      entityType: 'album',
      entityId: 'released',
      url: 'https://open.spotify.com/album/Released'
    })

    let summary = await run(runIdentityBackfillBatch(db, { apply: true }))
    await database.prepare("DELETE FROM music_entity_links WHERE id = 'released-link'").run()
    while (!summary.complete) {
      summary = await run(
        runIdentityBackfillBatch(db, {
          apply: true,
          generationId: summary.generationId ?? undefined
        })
      )
    }

    expect(await tableCount('music_source_identities')).toBe(0)
    expect(summary.identitiesCreated).toBe(0)
  })

  test('does not import a legacy claim that is no longer completed', async () => {
    await insertEntity('album', 'released-claim')
    await database
      .prepare(
        `INSERT INTO music_entity_resolution_claims (
           entity_type, canonical_url, entity_id, created_at, updated_at
         ) VALUES ('album', 'https://open.spotify.com/album/ReleasedClaim',
           'released-claim', 500, 500)`
      )
      .run()

    let summary = await run(runIdentityBackfillBatch(db, { apply: true }))
    summary = await run(
      runIdentityBackfillBatch(db, {
        apply: true,
        generationId: summary.generationId ?? undefined
      })
    )
    expect(summary.phase).toBe('apply')
    await database
      .prepare(
        `UPDATE music_entity_resolution_claims SET entity_id = NULL, owner_token = 'owner',
           lease_expires_at = 10000, updated_at = 10000
         WHERE entity_type = 'album' AND canonical_url = 'https://open.spotify.com/album/ReleasedClaim'`
      )
      .run()

    const completed = await applyToCompletion()

    expect(completed.identitiesCreated).toBe(0)
    expect(await tableCount('music_source_identities')).toBe(0)
  })

  test('durably reports active and expired resolving leases', async () => {
    await insertEntity('album', 'active-lease-owner')
    await insertEntity('album', 'expired-lease-owner')
    for (const [key, entityId, expires] of [
      ['ActiveLease', 'active-lease-owner', 10_000],
      ['ExpiredLease', 'expired-lease-owner', 100]
    ] as const) {
      await insertLink({
        id: key,
        entityType: 'album',
        entityId,
        url: `https://open.spotify.com/album/${key}`
      })
      await database
        .prepare(
          `INSERT INTO music_source_identities (
             source_key, platform, source_entity_type, external_id, canonical_url, state,
             owner_token, lease_expires_at, created_at, updated_at
           ) VALUES (?, 'spotify', 'album', ?, ?, 'resolving', 'owner', ?, 1, 1)`
        )
        .bind(`spotify:album:${key}`, key, `https://open.spotify.com/album/${key}`, expires)
        .run()
    }

    const summary = await applyToCompletion(10)
    const categories = (
      await database
        .prepare(
          `SELECT category FROM music_identity_maintenance_findings
           WHERE generation_id = ? ORDER BY category`
        )
        .bind(summary.generationId)
        .all<{ readonly category: string }>()
    ).results.map((row) => row.category)

    expect(categories).toEqual(['expired_lease', 'resolving_lease'])
    expect(summary.identitiesCreated).toBe(0)
  })

  test('reports actual created and touched counts without counting proposals', async () => {
    await insertEntity('album', 'existing')
    await insertEntity('album', 'new')
    await insertLink({
      id: 'existing-link',
      entityType: 'album',
      entityId: 'existing',
      url: 'https://open.spotify.com/album/Existing'
    })
    await insertLink({
      id: 'new-link',
      entityType: 'album',
      entityId: 'new',
      url: 'https://open.spotify.com/album/New'
    })
    await database
      .prepare(
        `INSERT INTO music_source_identities (
           source_key, platform, source_entity_type, external_id, canonical_url, state,
           entity_type, entity_id, resolved_at, created_at, updated_at
         ) VALUES ('spotify:album:Existing', 'spotify', 'album', 'Existing',
           'https://open.spotify.com/album/Existing', 'resolved', 'album', 'existing', 1, 1, 1)`
      )
      .run()
    await database
      .prepare(
        `INSERT INTO music_source_aliases (normalized_url, source_key, first_seen_at, last_seen_at)
         VALUES ('https://open.spotify.com/album/Existing', 'spotify:album:Existing', 1, 1)`
      )
      .run()

    const summary = await applyToCompletion(10)

    expect(summary).toMatchObject({
      proposed: 2,
      attempted: 2,
      identitiesCreated: 1,
      aliasesCreated: 1,
      aliasesTouched: 1
    })
  })

  test('durably reports candidate overflow and skips canonical mutations', async () => {
    await database
      .prepare(
        `WITH RECURSIVE sequence(value) AS (
           VALUES (1) UNION ALL SELECT value + 1 FROM sequence WHERE value < 101
         ) INSERT INTO music_albums (id, title, slug, createdAt, updatedAt)
         SELECT 'overflow-' || value, 'Overflow ' || value, 'overflow-' || value, 1000, 1000
         FROM sequence`
      )
      .run()
    await database
      .prepare(
        `WITH RECURSIVE sequence(value) AS (
           VALUES (1) UNION ALL SELECT value + 1 FROM sequence WHERE value < 101
         ) INSERT INTO music_entity_links (
           id, entity_type, entityId, platform, url, status, createdAt, updatedAt
         ) SELECT 'overflow-link-' || printf('%03d', value), 'album',
           'overflow-' || value, 'spotify',
           'https://open.spotify.com/album/Overflow?si=' || value,
           'verified', 1000 + value, 1000 + value FROM sequence`
      )
      .run()

    const summary = await applyToCompletion(50)
    const findings = (
      await database
        .prepare(
          `SELECT category, source_key AS sourceKey FROM music_identity_maintenance_findings
           WHERE generation_id = ?`
        )
        .bind(summary.generationId)
        .all<{ readonly category: string; readonly sourceKey: string }>()
    ).results

    expect(summary).toMatchObject({ candidates: 101, proposed: 1, attempted: 1 })
    expect(findings).toEqual([
      { category: 'candidate_overflow', sourceKey: 'spotify:album:Overflow' }
    ])
    expect(await tableCount('music_identity_maintenance_source_keys')).toBe(1)
    expect(await tableCount('music_source_identities')).toBe(0)
    expect(await tableCount('music_source_aliases')).toBe(0)
    expect(await tableCount('music_source_identity_conflicts')).toBe(0)
  })

  test('paginates conflicts without duplicates', async () => {
    await insertEntity('album', 'incumbent')
    await database
      .prepare(
        `INSERT INTO music_source_identities (
           source_key, platform, source_entity_type, external_id, canonical_url, state,
           entity_type, entity_id, resolved_at, created_at, updated_at
         ) VALUES ('spotify:album:ConflictAudit', 'spotify', 'album', 'ConflictAudit',
           'https://open.spotify.com/album/ConflictAudit', 'resolved', 'album', 'incumbent', 1, 1, 1)`
      )
      .run()
    for (let index = 1; index <= 3; index += 1) {
      await database
        .prepare(
          `INSERT INTO music_source_identity_conflicts (
             id, source_key, incumbent_entity_type, incumbent_entity_id,
             candidate_entity_type, candidate_entity_id, reason, status, detected_at
           ) VALUES (?, 'spotify:album:ConflictAudit', 'album', 'incumbent',
             'album', ?, 'test', 'open', ?)`
        )
        .bind(`conflict-${index}`, `candidate-${index}`, index)
        .run()
    }

    const first = await run(auditMusicIdentities(db, { phase: 'conflicts', batchSize: 2 }))
    const second = await run(
      auditMusicIdentities(db, {
        phase: 'conflicts',
        batchSize: 2,
        cursor: first.cursor ?? undefined
      })
    )

    expect(first.issues.map((issue) => issue.entityId)).toEqual(['candidate-1', 'candidate-2'])
    expect(second.issues.map((issue) => issue.entityId)).toEqual(['candidate-3'])
    expect(new Set([...first.issues, ...second.issues].map((issue) => issue.entityId)).size).toBe(3)
  })

  test('bounds link audit output and reports invalid and orphan links', async () => {
    await insertEntity('album', 'valid')
    await insertLink({
      id: 'invalid',
      entityType: 'album',
      entityId: 'valid',
      url: 'https://open.spotify.com/track/TypeMismatch'
    })
    await insertLink({
      id: 'orphan',
      entityType: 'album',
      entityId: 'missing',
      url: 'https://open.spotify.com/album/Orphan',
      createdAt: 2000
    })

    const first = await run(auditMusicIdentities(db, { phase: 'links', batchSize: 1 }))
    const second = await run(
      auditMusicIdentities(db, {
        phase: 'links',
        batchSize: 1,
        cursor: first.cursor ?? undefined
      })
    )

    expect(first.scanned).toBe(1)
    expect(first.issues).toHaveLength(1)
    expect(second.issues[0]?.category).toBe('orphaned_link')
  })

  test('pages clean identities before detecting later defects', async () => {
    await insertEntity('album', 'clean-a')
    await insertEntity('album', 'clean-b')
    await database
      .prepare(
        `INSERT INTO music_source_identities (
           source_key, platform, source_entity_type, external_id, canonical_url, state,
           entity_type, entity_id, resolved_at, created_at, updated_at
         ) VALUES
           ('spotify:album:clean-a', 'spotify', 'album', 'clean-a',
             'https://open.spotify.com/album/clean-a', 'resolved', 'album', 'clean-a', 1, 1, 1),
           ('spotify:album:clean-b', 'spotify', 'album', 'clean-b',
             'https://open.spotify.com/album/clean-b', 'resolved', 'album', 'clean-b', 1, 1, 1),
           ('spotify:album:missing-z', 'spotify', 'album', 'missing-z',
             'https://open.spotify.com/album/missing-z', 'resolved', 'album', 'missing-z', 1, 1, 1)`
      )
      .run()

    const first = await run(auditMusicIdentities(db, { phase: 'identities', batchSize: 2 }))
    const second = await run(
      auditMusicIdentities(db, {
        phase: 'identities',
        batchSize: 2,
        cursor: first.cursor ?? undefined
      })
    )

    expect(first).toMatchObject({ scanned: 2, detected: 0, complete: false, issues: [] })
    expect(second).toMatchObject({ scanned: 1, detected: 1, complete: true })
    expect(second.issues[0]?.category).toBe('orphaned_identity')
  })

  test('pages clean aliases before detecting later defects', async () => {
    const miniflare = new Miniflare({
      script: 'export default { fetch() { return new Response() } }',
      modules: true,
      d1Databases: { DB: 'orphan-alias-d1' }
    })
    database = await miniflare.getD1Database('DB')
    await database
      .prepare('CREATE TABLE music_source_identities (source_key text PRIMARY KEY)')
      .run()
    await database
      .prepare(
        `CREATE TABLE music_source_aliases (
           normalized_url text PRIMARY KEY, source_key text NOT NULL,
           first_seen_at integer NOT NULL, last_seen_at integer NOT NULL
         )`
      )
      .run()
    await database
      .prepare("INSERT INTO music_source_identities (source_key) VALUES ('clean-source')")
      .run()
    await database
      .prepare(
        `INSERT INTO music_source_aliases (normalized_url, source_key, first_seen_at, last_seen_at)
         VALUES ('https://open.spotify.com/album/CleanAlias', 'clean-source', 1, 1),
           ('https://open.spotify.com/album/OrphanAlias', 'missing-source', 1, 1)`
      )
      .run()
    db = drizzle(database, { schema })

    const first = await run(auditMusicIdentities(db, { phase: 'aliases', batchSize: 1 }))
    const second = await run(
      auditMusicIdentities(db, {
        phase: 'aliases',
        batchSize: 1,
        cursor: first.cursor ?? undefined
      })
    )

    expect(first).toMatchObject({ scanned: 1, detected: 0, complete: false, issues: [] })
    expect(second).toMatchObject({ scanned: 1, detected: 1 })
    expect(second.issues[0]?.category).toBe('orphaned_alias')
  })
})
