import { Effect } from 'effect'
import { afterAll } from 'vitest'
import { Database, DatabaseLayer } from '@/db/layer'
import { withTestLayer } from './effect'
import { createMigratedD1Database } from './migrate-d1'

const d1Resource = await createMigratedD1Database()
export const d1 = d1Resource.database

afterAll(() => d1Resource.dispose())

export const DatabaseTestLayer = DatabaseLayer(d1)
export const db = Effect.runSync(withTestLayer(Database, DatabaseTestLayer))
