import { Context, Layer } from 'effect'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'
import * as schema from './exports'

export class Database extends Context.Service<Database, NodePgDatabase<typeof schema>>()(
  'Database'
) {}

export const DatabaseLayer = (pool: Pool) => Layer.sync(Database, () => drizzle(pool, { schema }))
