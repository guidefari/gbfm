import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { db } from '@/db'
import { user as usersTable } from '@/db/auth.schema'
import { showCreators, showsTable } from '@/db/show.schema'
import { DatabaseError, NotFoundError } from '@/errors'
import { runApp } from '@/runtime'
import { buildErrorHtml, buildOGHtml } from '../redirect.template'

type HtmlResponse = { html: string; status: ContentfulStatusCode }

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
      return yield* new NotFoundError({
        message: 'Show not found',
        resource: 'show',
        id: slug
      })
    }

    const hosts = yield* fetchHosts(show.id)

    return {
      html: buildOGHtml({
        type: 'website',
        title: show.title || slug,
        description:
          show.description ||
          `Check out ${show.title || slug} on goosebumps.fm`,
        image: show.bannerImageUrl || show.thumbnailUrl,
        canonicalPath: `/shows/${slug}`,
        creators: hosts.map((h) => h.name),
        imageAlt: `${show.title || slug} show art`
      }),
      status: 200
    } satisfies HtmlResponse
  }).pipe(
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed<HtmlResponse>({
        html: buildErrorHtml({
          title: 'Show not found',
          message: "The show you're looking for doesn't exist.",
          statusCode: 404
        }),
        status: 404
      })
    ),
    Effect.catchTag('DatabaseError', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[Share] Error fetching show', {
          slug,
          error: error.message
        })
        return {
          html: buildErrorHtml({
            title: 'Error',
            message: 'Something went wrong while loading this show.',
            statusCode: 500
          }),
          status: 500
        } satisfies HtmlResponse
      })
    )
  )

  const response = await runApp(program)

  if (response.status === 200) {
    c.header('Cache-Control', 'public, max-age=3600')
  }

  return c.html(response.html, response.status)
}
