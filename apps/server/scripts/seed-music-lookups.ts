import { Effect } from 'effect'
import { pool } from '../src/db'
import { Database, DatabaseLayer } from '../src/db/layer'
import { seedMusicLookups } from '../src/db/seed-music-lookups'

Effect.runPromise(
  Effect.gen(function* () {
    const db = yield* Database
    return yield* Effect.promise(() => seedMusicLookups(db))
  }).pipe(Effect.provide(DatabaseLayer(pool)))
)
  .then(({ entityTypeCount, platformCount }) => {
    console.log(`Seeded ${entityTypeCount} music entity types`)
    console.log(`Seeded ${platformCount} music platforms`)
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
