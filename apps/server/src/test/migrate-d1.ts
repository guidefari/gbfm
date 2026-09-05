import type { D1Database } from '@cloudflare/workers-types'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Miniflare } from 'miniflare'

const directory = path.dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = path.resolve(directory, '../../drizzle-d1')

/** The forward D1 migrations used by local server tests. */
export const d1MigrationFiles = [
  '0000_public_thunderbolt.sql',
  '0001_search_fts.sql',
  '0002_email_provider_receipt.sql',
  '0003_music_entity_resolution_claim.sql',
  '0004_music_entity_resolution_claim_lease.sql',
  '0005_navigation_lookup_indexes.sql',
  '0006_canonical_music_identity.sql',
  '0007_music_identity_backfill_checkpoint.sql'
] as const

const splitStatements = (migration: string) =>
  migration
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)

/** Applies selected forward D1 migrations to a local D1 binding. */
export const applyD1Migrations = async (
  database: D1Database,
  migrations: ReadonlyArray<(typeof d1MigrationFiles)[number]> = d1MigrationFiles
) => {
  for (const migration of migrations) {
    for (const statement of splitStatements(
      readFileSync(path.join(migrationsDirectory, migration), 'utf8')
    )) {
      await database.prepare(statement).run()
    }
  }
}

/** Creates a Miniflare D1 database with the requested forward migrations. */
export const createMigratedD1Database = async (
  migrations: ReadonlyArray<(typeof d1MigrationFiles)[number]> = d1MigrationFiles
) => {
  const miniflare = new Miniflare({
    script: 'export default { fetch() { return new Response() } }',
    modules: true,
    d1Databases: { DB: 'test-d1' }
  })
  const database = await miniflare.getD1Database('DB')
  await applyD1Migrations(database, migrations)
  return database
}
