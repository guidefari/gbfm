import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Context } from 'hono'
import { db } from '@/db'
import { user as usersTable } from '@/db/auth.schema'
import { showCreators, showsTable } from '@/db/show.schema'
import { DatabaseError } from '@/errors'
import { runApp } from '@/runtime'
import { buildErrorHtml, buildOGHtml } from '../redirect.template'

const fetchShowBySlug = (slug: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(showsTable)
        .where(and(eq(showsTable.slug, slug), eq(showsTable.draft, false)))
        .limit(1),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'shows'
      })
  })

const fetchHosts = (showId: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select({
          id: usersTable.id,
          name: usersTable.name
        })
        .from(showCreators)
        .innerJoin(usersTable, eq(showCreators.creatorId, usersTable.id))
        .where(eq(showCreators.showId, showId)),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'show_creators'
      })
  })

export const shareShow = async (c: Context) => {
  const { slug } = c.req.param()

  if (!slug) {
    return c.html(
      buildErrorHtml({
        title: 'Invalid URL',
        message: 'The URL is missing a show slug.',
        statusCode: 400
      }),
      400
    )
  }

  const program = Effect.gen(function* () {
    const [show] = yield* fetchShowBySlug(slug)
    if (!show) {
      return { found: false } as const
    }

    const hosts = yield* fetchHosts(show.id)
    return { found: true, show, hosts } as const
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    Effect.logError('[Share] Error fetching show', {
      slug,
      error:
        result.left instanceof Error ? result.left.message : String(result.left)
    }).pipe(Effect.runPromise)

    return c.html(
      buildErrorHtml({
        title: 'Error',
        message: 'Something went wrong while loading this show.',
        statusCode: 500
      }),
      500
    )
  }

  const data = result.right
  if (!data.found) {
    return c.html(
      buildErrorHtml({
        title: 'Show not found',
        message: "The show you're looking for doesn't exist.",
        statusCode: 404
      }),
      404
    )
  }

  const { show, hosts } = data

  const html = buildOGHtml({
    type: 'website',
    title: show.title || slug,
    description:
      show.description || `Check out ${show.title || slug} on goosebumps.fm`,
    image: show.bannerImageUrl || show.thumbnailUrl,
    canonicalPath: `/shows/${slug}`,
    creators: hosts.map((h) => h.name),
    imageAlt: `${show.title || slug} show art`
  })

  c.header('Cache-Control', 'public, max-age=3600')
  return c.html(html)
}
