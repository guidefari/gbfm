import { Effect } from 'effect'
import { Database, DatabaseLayer } from '@/db/layer'
import { withTestLayer } from './effect'
import { createMigratedD1Database } from './migrate-d1'

export const d1 = await createMigratedD1Database()

export const DatabaseTestLayer = DatabaseLayer(d1)
export const db = Effect.runSync(withTestLayer(Database, DatabaseTestLayer))
