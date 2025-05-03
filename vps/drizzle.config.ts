import { env } from '@/env';
import { defineConfig } from 'drizzle-kit';
import { Resource } from 'sst';

function getDbCredentials() {
  const isLocal = Resource.App.name === "local";

  if (isLocal) {
    return `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`
  }
  return `postgresql://${Resource.gbfm_postgres.username}:${Resource.gbfm_postgres.password}@${Resource.gbfm_postgres.host}:${Resource.gbfm_postgres.port}/${Resource.gbfm_postgres.database}`
}

const credentials = getDbCredentials();
console.log('credentials:', credentials)

export default defineConfig({
  out: './drizzle',
  schema: './src/db/*.schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: credentials,
  },
});
