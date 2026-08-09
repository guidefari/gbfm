import { Context, Layer } from 'effect'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'
import * as schema from './exports'

export type DatabaseClient = NodePgDatabase<typeof schema> & { readonly $client: Pool }

export class Database extends Context.Service<Database, DatabaseClient>()('Database') {}

export const DatabaseLayer = (pool: Pool) => Layer.sync(Database, () => drizzle(pool, { schema }))
