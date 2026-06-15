import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator'
import { db } from './db'
import { seedMusicLookups } from './db/seed-music-lookups'

export const migrate = async (path: string) => {
  console.log('Running migrations...')
  await migratePostgres(db, { migrationsFolder: path })
  const { entityTypeCount, platformCount } = await seedMusicLookups()
  console.log(`Seeded ${entityTypeCount} music entity types and ${platformCount} music platforms.`)
  console.log('Migrations completed.')
}
migrate('./drizzle/')
