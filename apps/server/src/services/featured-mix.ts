import { and, desc, eq, isNotNull, or, sql } from 'drizzle-orm'
import { Effect } from 'effect'

import { audioTable } from '@/db/audio.schema'
import { featuredMixTable } from '@/db/featured-mix.schema'
import { Database } from '@/db/layer'
import { DatabaseError, ValidationError } from '@/errors'

/** Lists all published choices and the stored selection, even when it is no longer published. */
export const loadFeaturedMix = Effect.fn('FeaturedMix.load')(function* () {
  const db = yield* Database

  return yield* Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({
          id: audioTable.id,
          title: audioTable.title,
          type: audioTable.type,
          draft: audioTable.draft,
          selectedId: featuredMixTable.audioId,
        })
        .from(audioTable)
        .leftJoin(featuredMixTable, eq(featuredMixTable.audioId, audioTable.id))
        .where(
          or(
            and(eq(audioTable.type, 'mix'), eq(audioTable.draft, false)),
            isNotNull(featuredMixTable.audioId),
          ),
        )
        .orderBy(desc(audioTable.createdAt), desc(audioTable.id))

      const isPublished = (mix: (typeof rows)[number]) => mix.type === 'mix' && !mix.draft
      const selected = rows.find((mix) => mix.selectedId !== null)

      return {
        mixId: selected?.id ?? null,
        unavailableTitle: selected && !isPublished(selected) ? selected.title : null,
        mixes: rows.filter(isPublished).map(({ id, title }) => ({ id, title })),
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

/** One content statement, with indexed scalar lookups rather than sorting the catalogue. */
export const getHomepageMixes = Effect.fn('FeaturedMix.homepage')(function* () {
  const db = yield* Database
  const publishedMix = and(eq(audioTable.type, 'mix'), eq(audioTable.draft, false))

  const selected = db
    .select({ id: audioTable.id })
    .from(featuredMixTable)
    .innerJoin(audioTable, eq(audioTable.id, featuredMixTable.audioId))
    .where(and(eq(featuredMixTable.slot, 1), publishedMix))

  const newest = db
    .select({ id: audioTable.id })
    .from(audioTable)
    .where(publishedMix)
    .orderBy(desc(audioTable.createdAt))
    .limit(1)

  const mix = yield* Effect.tryPromise({
    try: () =>
      db.query.audioTable.findFirst({
        where: eq(audioTable.id, sql`coalesce((${selected}), (${newest}))`),
        columns: { id: true, title: true, slug: true, url: true, thumbnailUrl: true },
        with: {
          audioCreators: {
            columns: {},
            with: { creator: { columns: { id: true, name: true, username: true } } },
          },
          show: { columns: { thumbnailUrl: true } },
        },
      }),
    catch: () =>
      new DatabaseError({
        message: 'Could not load homepage mix.',
        operation: 'select',
        table: 'audio',
      }),
  })

  if (!mix) return { data: [] }
  const { audioCreators, show, ...audio } = mix

  return {
    data: [
      {
        ...audio,
        type: 'mix' as const,
        thumbnailUrl: audio.thumbnailUrl ?? show?.thumbnailUrl ?? null,
        creators: audioCreators.map(({ creator }) => creator),
      },
    ],
  }
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
