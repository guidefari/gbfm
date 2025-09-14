import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { Resource } from 'sst'

const pool = new Pool({
  host: Resource.DatabaseHost.value,
  port: Number(Resource.DatabasePort.value),
  user: Resource.DatabaseUser.value,
  password: Resource.DatabasePassword.value,
  database: Resource.DatabaseName.value
})

export const db = drizzle(pool)
