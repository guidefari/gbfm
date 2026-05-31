import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { db } from '@/db'
import { user as usersTable } from '@/db/auth.schema'
import { labelCreators, labelsTable } from '@/db/label.schema'
import { DatabaseError, NotFoundError } from '@/errors'
import { runApp } from '@/runtime'
import { buildErrorHtml, buildOGHtml } from '../redirect.template'

type HtmlResponse = { html: string; status: ContentfulStatusCode }

const fetchLabelBySlug = (slug: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(labelsTable)
        .where(and(eq(labelsTable.slug, slug), eq(labelsTable.draft, false)))
        .limit(1),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'labels'
      })
  })

const fetchCreators = (labelId: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select({
          id: usersTable.id,
          name: usersTable.name
        })
        .from(labelCreators)
        .innerJoin(usersTable, eq(labelCreators.creatorId, usersTable.id))
        .where(eq(labelCreators.labelId, labelId)),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'label_creators'
      })
  })

export const shareLabel = async (c: Context) => {
  const { slug } = c.req.param()

  if (!slug) {
    return c.html(
      buildErrorHtml({
        title: 'Invalid URL',
        message: 'The URL is missing a label slug.',
        statusCode: 400
      }),
      400
    )
  }

  const program = Effect.gen(function* () {
    const [label] = yield* fetchLabelBySlug(slug)
    if (!label) {
      return yield* new NotFoundError({
        message: 'Label not found',
        resource: 'label',
        id: slug
      })
    }

    const creators = yield* fetchCreators(label.id)

    const description = label.description || `Check out ${label.title || slug} on goosebumps.fm`
    const genresSuffix =
      label.genres && label.genres.length > 0 ? ` | Genres: ${label.genres.join(', ')}` : ''

    return {
      html: buildOGHtml({
        type: 'website',
        title: label.title || slug,
        description: description + genresSuffix,
        image: label.thumbnailUrl,
        canonicalPath: `/labels/${slug}`,
        creators: creators.map((c) => c.name),
        imageAlt: `${label.title || slug} label art`
      }),
      status: 200
    } satisfies HtmlResponse
  }).pipe(
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed<HtmlResponse>({
        html: buildErrorHtml({
          title: 'Label not found',
          message: "The label you're looking for doesn't exist.",
          statusCode: 404
        }),
        status: 404
      })
    ),
    Effect.catchTag('DatabaseError', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[Share] Error fetching label', {
          slug,
          error: error.message
        })
        return {
          html: buildErrorHtml({
            title: 'Error',
            message: 'Something went wrong while loading this label.',
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
