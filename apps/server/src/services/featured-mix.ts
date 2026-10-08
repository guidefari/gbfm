import { and, desc, eq, sql } from 'drizzle-orm'
import { Effect } from 'effect'

import { audioTable } from '@/db/audio.schema'
import { featuredMixTable } from '@/db/featured-mix.schema'
import { Database } from '@/db/layer'
import { DatabaseError, ValidationError } from '@/errors'

/** Lists all published choices and the effective editorial selection. */
export const loadFeaturedMix = Effect.fn('FeaturedMix.load')(function* () {
  const db = yield* Database

  return yield* Effect.tryPromise({
    try: async () => {
      const mixes = await db
        .select({ id: audioTable.id, title: audioTable.title })
        .from(audioTable)
        .where(and(eq(audioTable.type, 'mix'), eq(audioTable.draft, false)))
        .orderBy(desc(audioTable.createdAt), desc(audioTable.id))

      const [selection] = await db.select().from(featuredMixTable)

      return {
        mixId: mixes.some((mix) => mix.id === selection?.audioId)
          ? (selection?.audioId ?? null)
          : null,
        mixes,
      }
    },
    catch: () =>
      new DatabaseError({
        message: 'Could not load featured mix.',
        operation: 'select',
        table: 'featured_mix',
      }),
  })
})

/** Atomically replaces the singleton, rejecting missing, draft, and non-mix audio. */
export const saveFeaturedMix = Effect.fn('FeaturedMix.save')(function* (mixId: string | null) {
  const db = yield* Database

  const accepted = yield* Effect.tryPromise({
    try: async () => {
      if (mixId === null) {
        await db.delete(featuredMixTable)

        return true
      }

      const result = await db.run(sql`
        INSERT INTO featured_mix (slot, audio_id)
        SELECT 1, id FROM audio WHERE id = ${mixId} AND type = 'mix' AND draft = 0
        ON CONFLICT(slot) DO UPDATE SET audio_id = excluded.audio_id
      `)

      return result.meta.changes > 0
    },
    catch: () =>
      new DatabaseError({
        message: 'Could not save featured mix.',
        operation: 'update',
        table: 'featured_mix',
      }),
  })

  if (!accepted) return yield* new ValidationError({ message: 'Choose a published mix.' })

  return undefined
})
