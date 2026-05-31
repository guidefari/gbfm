import { defineConfig } from 'drizzle-kit'
import { config } from './src/services/config.service'
const dbConfig = {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  ssl: false
}

const dbStage = config.app.dbStage || 'dev'

console.log('connecting to db stage', dbStage)

export default defineConfig({
  out: './drizzle',
  schema: './src/db/*.schema.ts',
  dialect: 'postgresql',
  dbCredentials: dbConfig
})
