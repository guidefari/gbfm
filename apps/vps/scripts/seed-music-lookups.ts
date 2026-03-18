import { seedMusicLookups } from '../src/db/seed-music-lookups'

seedMusicLookups()
  .then(({ entityTypeCount, platformCount }) => {
    console.log(`Seeded ${entityTypeCount} music entity types`)
    console.log(`Seeded ${platformCount} music platforms`)
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
