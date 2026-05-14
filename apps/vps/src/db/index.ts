import { config } from '@/services/config.service'
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

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
  ssl: sslConfig
}

console.log(
  `[DB] Connecting stage=${config.app.dbStage || 'prod'} host=${dbConfig.host} db=${dbConfig.database}`
)

const pool = new Pool(dbConfig)

export { pool }
export const db = drizzle(pool)
