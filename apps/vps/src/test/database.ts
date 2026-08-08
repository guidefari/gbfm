import { Effect } from 'effect'
import { pool } from '@/db'
import { Database, DatabaseLayer } from '@/db/layer'

export const DatabaseTestLayer = DatabaseLayer(pool)
export const db = Effect.runSync(Database.pipe(Effect.provide(DatabaseTestLayer)))
