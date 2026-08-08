import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator'
import { Effect } from 'effect'
import { pool } from './db'
import { Database, DatabaseLayer } from './db/layer'
import { seedMusicLookups } from './db/seed-music-lookups'

export const migrate = (path: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    console.log('Running migrations...')
    yield* Effect.promise(() => migratePostgres(db, { migrationsFolder: path }))
    const { entityTypeCount, platformCount } = yield* Effect.promise(() => seedMusicLookups(db))
    console.log(
      `Seeded ${entityTypeCount} music entity types and ${platformCount} music platforms.`
    )
    console.log('Migrations completed.')
  })

void Effect.runPromise(migrate('./drizzle/').pipe(Effect.provide(DatabaseLayer(pool))))
