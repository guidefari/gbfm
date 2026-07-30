import { config } from '@/services/config.service'
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { instrumentDatabaseClient } from '@/lib/database-instrumentation'
import * as schema from './exports'

const stage = config.app.stage

const sslByStage: Record<string, boolean | { rejectUnauthorized: boolean }> = {
  prod: true,
  test: false,
  dev: { rejectUnauthorized: false }
}
const sslConfig = sslByStage[stage] ?? { rejectUnauthorized: false }

const dbConfig = {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  ssl: sslConfig,
  min: 1,
  idleTimeoutMillis: 10 * 60 * 1000
}

console.log(
  `[DB] Connecting stage=${config.app.dbStage || 'prod'} host=${dbConfig.host} db=${dbConfig.database}`
)

const pool = new Pool(dbConfig)
pool.on('connect', (client) => instrumentDatabaseClient(client))

export { pool }
export const db = drizzle(pool, { schema })
