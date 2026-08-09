import { Context, Layer } from 'effect'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import type { D1Database } from '@cloudflare/workers-types'
import * as schema from './exports'

export type DatabaseClient = DrizzleD1Database<typeof schema>

export class Database extends Context.Service<Database, DatabaseClient>()('Database') {}

export const DatabaseLayer = (database: D1Database) =>
  Layer.sync(Database, () => drizzle(database, { schema }))
