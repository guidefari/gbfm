import { audioTable } from '../src/db/audio.schema'
import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { pool } from '../src/db'
import { Database, DatabaseLayer } from '../src/db/layer'

const db = Effect.runSync(Database.pipe(Effect.provide(DatabaseLayer(pool))))

async function renameAudioCdnName() {
  // Fetch all audio rows
  const audios = await db.select().from(audioTable)
  let updatedCount = 0

  for (const audio of audios) {
    if (typeof audio.url === 'string' && audio.url.includes('files.dev')) {
      const newUrl = audio.url.replace('files.dev', 'cdn.dev')
      if (newUrl !== audio.url) {
        await db.update(audioTable).set({ url: newUrl }).where(eq(audioTable.id, audio.id))
        updatedCount++
      }
    }
  }

  console.log(`Updated ${updatedCount} audio URLs.`)
}

renameAudioCdnName().catch((err) => {
  console.error(err)
  process.exit(1)
})
