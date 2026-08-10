import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator'
import { Effect } from 'effect'
import { pool } from './db'
import { Database, DatabaseLayer } from './db/layer'
import { seedMusicLookups } from './db/seed-music-lookups'

export const migrate = (path: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    console.log('Running migrations...')
    // @ts-expect-error This Postgres migrator is retained until M4 replaces the Bun runtime.
    yield* Effect.promise(() => migratePostgres(db, { migrationsFolder: path }))
    const { entityTypeCount, platformCount } = yield* Effect.promise(() => seedMusicLookups(db))
    console.log(
      `Seeded ${entityTypeCount} music entity types and ${platformCount} music platforms.`
    )
    console.log('Migrations completed.')
  })

// @ts-expect-error This Postgres entry point is retained until M4 replaces the Bun runtime.
void Effect.runPromise(migrate('./drizzle/').pipe(Effect.provide(DatabaseLayer(pool))))
