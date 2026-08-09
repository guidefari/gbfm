import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/d1'
import { Miniflare } from 'miniflare'
import * as schema from '@/db/exports'

const directory = path.dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = path.resolve(directory, '../../drizzle-d1')

const splitStatements = (migration: string) =>
  migration
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)

const miniflare = new Miniflare({
  script: 'export default { fetch() { return new Response() } }',
  modules: true,
  d1Databases: { DB: 'test-d1' }
})

const database = await miniflare.getD1Database('DB')

for (const migration of ['0000_public_thunderbolt.sql', '0001_search_fts.sql']) {
  for (const statement of splitStatements(
    readFileSync(path.join(migrationsDirectory, migration), 'utf8')
  )) {
    await database.prepare(statement).run()
  }
}

export const d1 = database
export const db = drizzle(d1, { schema })
