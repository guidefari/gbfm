import { db } from '../src/db';
import { mixesTable, mixCreators } from '../src/db/mix.schema';
import { audioTable, audioCreators } from '../src/db/audio.schema';
import { eq } from 'drizzle-orm';

async function migrateMixesToAudio() {
  // 1. Fetch all mixes
  const mixes = await db.select().from(mixesTable);

  for (const mix of mixes) {
    // 2. Insert into audio table
    const [audio] = await db
      .insert(audioTable)
      .values({
        id: mix.id,
        slug: mix.slug,
        title: mix.title,
        description: mix.description,
        url: mix.url,
        createdAt: mix.createdAt,
        updatedAt: mix.updatedAt,
        type: 'mix',
        thumbnailUrl: mix.thumbnailUrl,
        content: mix.content,
      })
      .returning();

    if (!audio) {
      throw new Error(`Failed to insert audio for mix ${mix.id}`);
    }

    // 3. Fetch mix authors
    const mixAuthors = await db
      .select()
      .from(mixCreators)
      .where(eq(mixCreators.mixId, mix.id));

    // 4. Insert into audio_creators
    for (const { creatorId } of mixAuthors) {
      await db.insert(audioCreators).values({
        audioId: audio.id,
        creatorId,
      });
    }
  }

  console.log('Migration complete!');
}

migrateMixesToAudio().catch((err) => {
  console.error(err);
  process.exit(1);
});