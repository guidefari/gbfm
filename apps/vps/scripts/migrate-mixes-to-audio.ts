import { db } from '../src/db';
import { mixesTable, mixesToAuthors } from '../src/db/mix.schema';
import { audioTable, audioToAuthors } from '../src/db/audio.schema';
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
      .from(mixesToAuthors)
      .where(eq(mixesToAuthors.mixId, mix.id));

    // 4. Insert into audio_to_authors
    for (const { authorId } of mixAuthors) {
      await db.insert(audioToAuthors).values({
        audioId: audio.id,
        authorId,
      });
    }
  }

  console.log('Migration complete!');
}

migrateMixesToAudio().catch((err) => {
  console.error(err);
  process.exit(1);
});