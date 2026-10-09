import { drizzle } from 'drizzle-orm/d1'
import { Effect, Schema } from 'effect'

import * as schema from '../src/db/exports'
import { Database } from '../src/db/layer'
import type { DatabaseError } from '../src/errors'
import { getHomepageMixes, loadFeaturedMix } from '../src/services/featured-mix'
import { createMigratedD1Database } from '../src/test/migrate-d1'

const Parameters = Schema.Array(Schema.Union([Schema.String, Schema.Number, Schema.Null]))
const warmups = 10
const samples = 50
const results = []
type ReadResult =
  | Effect.Success<ReturnType<typeof getHomepageMixes>>
  | Effect.Success<ReturnType<typeof loadFeaturedMix>>
const operations: ReadonlyArray<
  readonly [string, Effect.Effect<ReadResult, DatabaseError, Database>]
> = [
  ['homepage', getHomepageMixes()],
  ['admin', loadFeaturedMix()],
]

// Real local Miniflare D1: no injected latency, mocks, credentials, or remote writes.
await using resource = await createMigratedD1Database()
const d1 = resource.database
for (const size of [100, 10_000]) {
  await d1.batch([
    d1.prepare('DELETE FROM featured_mix'),
    d1.prepare('DELETE FROM audio_creators'),
    d1.prepare('DELETE FROM audio'),
    d1.prepare('DELETE FROM user'),
  ])
  await d1
    .prepare(`
    WITH RECURSIVE sequence(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM sequence WHERE n < ?)
    INSERT INTO audio (id, title, slug, type, url, content, draft, createdAt, updatedAt)
    SELECT 'mix-' || n, 'Fixture mix ' || n, 'fixture-mix-' || n, 'mix',
      'https://example.com/audio.mp3', printf('%02000d', n), 0, n, n FROM sequence
  `)
    .bind(size)
    .run()
  await d1
    .prepare(`INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
    VALUES ('creator', 'Fixture Creator', 'fixture@example.com', 1, 1, 1)`)
    .run()
  await d1
    .prepare(`INSERT INTO audio_creators (audioId, creatorId) SELECT id, 'creator' FROM audio`)
    .run()

  const queries: Array<{ sql: string; params: ReadonlyArray<string | number | null> }> = []
  const db = drizzle(d1, {
    schema,
    logger: {
      logQuery: (sql, params) =>
        queries.push({ sql, params: Schema.decodeUnknownSync(Parameters)(params) }),
    },
  })
  for (const mode of ['automatic', 'selected']) {
    if (mode === 'selected')
      await d1.prepare(`INSERT INTO featured_mix (slot, audio_id) VALUES (1, 'mix-1')`).run()
    for (const [operation, effect] of operations) {
      const run = () => Effect.runPromise(effect.pipe(Effect.provideService(Database, db)))
      for (let index = 0; index < warmups; index++) await run()
      const timings: Array<number> = []
      let bytes = 0
      for (let index = 0; index < samples; index++) {
        queries.length = 0
        const start = performance.now()
        const output = await run()
        timings.push(performance.now() - start)
        bytes = Buffer.byteLength(JSON.stringify(output))
      }
      timings.sort((a, b) => a - b)
      const plans = []
      for (const query of queries) {
        const plan = await d1
          .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
          .bind(...query.params)
          .all()
        plans.push(plan.results)
      }
      results.push({
        size,
        mode,
        operation,
        statements: queries.length,
        bytes,
        medianMs: timings[Math.floor(samples / 2)],
        p95Ms: timings[Math.ceil(samples * 0.95) - 1],
        plans,
      })
      console.error(`Measured ${operation}: ${size} mixes, ${mode}`)
    }
  }
}
console.log(JSON.stringify({ runtime: 'local Miniflare D1', warmups, samples, results }, null, 2))
