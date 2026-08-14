import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Miniflare } from 'miniflare'
import { describe, expect, test } from 'vitest'
import { applyMigrations, TABLES, transformValue } from '../../scripts/migrate-pg-to-d1'
import { applyD1Migrations } from '@/test/migrate-d1'

describe('PG-to-D1 email delivery-log transform', () => {
  test('maps historical SES receipts to the neutral provider fields', () => {
    const emailLogs = TABLES.find((table) => table.target === 'email_delivery_logs')
    const providerColumn = emailLogs?.columns.find((column) => column.target === 'provider')
    const messageIdColumn = emailLogs?.columns.find(
      (column) => column.target === 'providerMessageId'
    )

    expect(providerColumn).toMatchObject({ source: 'sesMessageId', kind: 'ses-provider' })
    expect(messageIdColumn).toMatchObject({ source: 'sesMessageId', kind: 'text' })
    expect(transformValue('ses-message-1', 'ses-provider')).toBe('ses')
    expect(transformValue(null, 'ses-provider')).toBeNull()
  })

  test('upgrades an existing persisted 0000/0001 target and records the baseline idempotently', async () => {
    const persistencePath = await mkdtemp(path.join(tmpdir(), 'gbfm-d1-migrations-'))
    const createTarget = () =>
      new Miniflare({
        script: 'export default { fetch() { return new Response() } }',
        modules: true,
        d1Databases: { DB: 'migration-target' },
        resourcePersistencePath: persistencePath
      })
    const originalTarget = createTarget()

    try {
      await applyD1Migrations(await originalTarget.getD1Database('DB'), [
        '0000_public_thunderbolt.sql',
        '0001_search_fts.sql'
      ])
      await originalTarget.dispose()

      const upgradedTarget = createTarget()
      try {
        const d1 = await upgradedTarget.getD1Database('DB')
        await applyMigrations(d1)
        await applyMigrations(d1)

        const columns = await d1
          .prepare('PRAGMA table_info(email_delivery_logs)')
          .all<{ name: string }>()
        const ledger = await d1
          .prepare('select name from __gbfm_local_migration_ledger order by name')
          .all<{ name: string }>()

        expect(columns.results.map((column) => column.name)).toEqual(
          expect.arrayContaining(['provider', 'providerMessageId', 'failureCategory'])
        )
        expect(ledger.results.map((row) => row.name)).toEqual([
          '0000_public_thunderbolt.sql',
          '0001_search_fts.sql',
          '0002_email_provider_receipt.sql'
        ])
      } finally {
        await upgradedTarget.dispose()
      }
    } finally {
      await rm(persistencePath, { force: true, recursive: true })
    }
  })

  test('backfills one canonical music resolution claim for each existing entity link URL', async () => {
    const persistencePath = await mkdtemp(path.join(tmpdir(), 'gbfm-d1-music-claims-'))
    const target = new Miniflare({
      script: 'export default { fetch() { return new Response() } }',
      modules: true,
      d1Databases: { DB: 'music-claims-target' },
      resourcePersistencePath: persistencePath
    })

    try {
      const d1 = await target.getD1Database('DB')
      await applyD1Migrations(d1, ['0000_public_thunderbolt.sql'])
      await d1
        .prepare("INSERT INTO music_entity_types (id, displayName) VALUES ('track', 'Track')")
        .run()
      await d1
        .prepare("INSERT INTO music_platforms (id, displayName) VALUES ('spotify', 'Spotify')")
        .run()
      await d1
        .prepare(
          "INSERT INTO music_entity_links (id, entity_type, entityId, platform, url, status, createdAt, updatedAt) VALUES (?, 'track', ?, 'spotify', 'https://open.spotify.com/track/existing', 'verified', 1, 1)"
        )
        .bind('first-link', 'first-entity')
        .run()
      await d1
        .prepare(
          "INSERT INTO music_entity_links (id, entity_type, entityId, platform, url, status, createdAt, updatedAt) VALUES (?, 'track', ?, 'spotify', 'https://open.spotify.com/track/existing', 'verified', 2, 2)"
        )
        .bind('second-link', 'second-entity')
        .run()

      await applyD1Migrations(d1, ['0003_music_entity_resolution_claim.sql'])

      const claims = await d1
        .prepare(
          'SELECT entity_type, canonical_url, entity_id, created_at, updated_at FROM music_entity_resolution_claims'
        )
        .all<{
          entity_type: string
          canonical_url: string
          entity_id: string
          created_at: number
          updated_at: number
        }>()

      expect(claims.results).toEqual([
        {
          entity_type: 'track',
          canonical_url: 'https://open.spotify.com/track/existing',
          entity_id: 'first-entity',
          created_at: 1,
          updated_at: 1
        }
      ])
    } finally {
      await target.dispose()
      await rm(persistencePath, { force: true, recursive: true })
    }
  })
})
