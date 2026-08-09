import { Effect } from 'effect'
import { pool } from '@/db'
import { Database, DatabaseLayer } from '@/db/layer'

// @ts-expect-error The Testcontainers Postgres harness is replaced by Miniflare D1 in M4.
export const DatabaseTestLayer = DatabaseLayer(pool)
export const db = Effect.runSync(Database.pipe(Effect.provide(DatabaseTestLayer)))
