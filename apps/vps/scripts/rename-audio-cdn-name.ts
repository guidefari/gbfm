import { db } from '../src/db'
import { audioTable } from '../src/db/audio.schema'
import { eq } from 'drizzle-orm'

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
