import { Resource } from 'sst'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/drizzle/**/*.sql.ts',
  dialect: 'postgresql',
  out: './migrations',
  casing: 'snake_case',
  dbCredentials: {
    url: Resource.FullDatabaseUrl.value
  },
  verbose: true,
  strict: true
})
