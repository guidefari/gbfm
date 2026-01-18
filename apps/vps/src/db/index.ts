import { Effect } from 'effect'
import { env } from '@/env'
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { Resource } from 'sst'

const localPgConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres'
}

const prodPgConfig = {
  host: Resource.DatabaseHost.value,
  port: Number(Resource.DatabasePort.value),
  user: Resource.DatabaseUser.value,
  password: Resource.DatabasePassword.value,
  database: Resource.DatabaseName.value
}

const config = env.DB_STAGE === 'dev' ? localPgConfig : prodPgConfig
Effect.logInfo('[DB] Connecting to database', {
  stage: env.DB_STAGE || 'prod',
  host: config.host,
  database: config.database
}).pipe(Effect.runPromise)

const pool = new Pool(config)

export const db = drizzle(pool)
