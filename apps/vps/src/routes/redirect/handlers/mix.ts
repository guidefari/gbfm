import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Context } from 'hono'
import { db } from '@/db'
import { audioCreators, audioTable } from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
import { DatabaseError } from '@/errors'
import { runApp } from '@/runtime'
import { buildErrorHtml, buildOGHtml } from '../redirect.template'

const fetchMixBySlug = (slug: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(audioTable)
        .where(and(eq(audioTable.type, 'mix'), eq(audioTable.slug, slug)))
        .limit(1),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'audio'
      })
  })

const fetchCreators = (audioId: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select({
          id: usersTable.id,
          name: usersTable.name
        })
        .from(audioCreators)
        .innerJoin(usersTable, eq(audioCreators.creatorId, usersTable.id))
        .where(eq(audioCreators.audioId, audioId)),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'audio_creators'
      })
  })

export const shareMix = async (c: Context) => {
  const { slug } = c.req.param()

  if (!slug) {
    return c.html(
      buildErrorHtml({
        title: 'Invalid URL',
        message: 'The URL is missing a mix slug.',
        statusCode: 400
      }),
      400
    )
  }

  const program = Effect.gen(function* () {
    const [audio] = yield* fetchMixBySlug(slug)
    if (!audio) {
      return { found: false } as const
    }

    const creators = yield* fetchCreators(audio.id)
    return { found: true, audio, creators } as const
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    Effect.logError('[Share] Error fetching mix', {
      slug,
      error:
        result.left instanceof Error ? result.left.message : String(result.left)
    }).pipe(Effect.runPromise)

    return c.html(
      buildErrorHtml({
        title: 'Error',
        message: 'Something went wrong while loading this mix.',
        statusCode: 500
      }),
      500
    )
  }

  const data = result.right
  if (!data.found) {
    return c.html(
      buildErrorHtml({
        title: 'Mix not found',
        message: "The mix you're looking for doesn't exist.",
        statusCode: 404
      }),
      404
    )
  }

  const { audio, creators } = data

  const html = buildOGHtml({
    type: 'music.song',
    title: audio.title || slug,
    description:
      audio.description || `Listen to ${audio.title || slug} on goosebumps.fm`,
    image: audio.thumbnailUrl,
    canonicalPath: `/mixes/${slug}`,
    audio: audio.url,
    creators: creators.map((c) => c.name),
    imageAlt: `${audio.title || slug} cover art`
  })

  c.header('Cache-Control', 'public, max-age=3600')
  return c.html(html)
}
