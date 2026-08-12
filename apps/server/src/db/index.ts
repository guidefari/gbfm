import { createConfig } from '@/services/config.service'
import 'dotenv/config'
import { Pool } from 'pg'
import { instrumentDatabaseClient } from '@/lib/database-instrumentation'

const config = createConfig()
const stage = config.app.stage

const sslForStage = (value: string) => {
  if (value === 'prod') return true
  if (value === 'test') return false
  return { rejectUnauthorized: false }
}
// The docker-compose postgres is built without SSL support, so offering it any
// ssl option makes pg fail the handshake outright ("The server does not support
// SSL connections") rather than fall back to plaintext.
const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(config.database.host)
const sslConfig = isLocalHost ? false : sslForStage(stage)

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

const pool = instrumentDatabaseClient(new Pool(dbConfig))
pool.on('connect', (client) => instrumentDatabaseClient(client))

export { pool }
