import { defineConfig } from 'drizzle-kit'
import { config } from './src/services/config.service'

export default defineConfig({
  out: './drizzle',
  schema: './src/db/*.schema.ts',
  dialect: 'sqlite',
  dbCredentials: { url: config.database.name }
})
