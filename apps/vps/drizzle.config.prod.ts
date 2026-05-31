import { defineConfig } from 'drizzle-kit'
import { config } from './src/services/config.service'

export default defineConfig({
  out: './drizzle',
  schema: './src/db/*.schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name
    // ssl: false,
  }
})
