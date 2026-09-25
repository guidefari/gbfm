import { Context, Layer } from 'effect'
import { drizzle } from 'drizzle-orm/d1'
import type { D1Database } from '@cloudflare/workers-types'
import * as schema from './exports'

export type DatabaseClient = ReturnType<typeof drizzle<typeof schema, D1Database>>

export class Database extends Context.Service<Database, DatabaseClient>()('Database') {}

export const makeDatabaseClient = (database: D1Database): DatabaseClient =>
  drizzle(database, { schema })

export const DatabaseLayer = (database: D1Database) =>
  Layer.sync(Database, () => makeDatabaseClient(database))
