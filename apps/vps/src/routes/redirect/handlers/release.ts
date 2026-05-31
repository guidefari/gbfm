import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { db } from '@/db'
import { labelsTable } from '@/db/label.schema'
import { releasesTable } from '@/db/release.schema'
import { DatabaseError, NotFoundError } from '@/errors'
import { runApp } from '@/runtime'
import { buildErrorHtml, buildOGHtml } from '../redirect.template'

type HtmlResponse = { html: string; status: ContentfulStatusCode }

const fetchReleaseBySlug = (slug: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select({
          id: releasesTable.id,
          title: releasesTable.title,
          slug: releasesTable.slug,
          description: releasesTable.description,
          thumbnailUrl: releasesTable.thumbnailUrl,
          labelId: releasesTable.labelId,
          releaseDate: releasesTable.releaseDate
        })
        .from(releasesTable)
        .where(and(eq(releasesTable.slug, slug), eq(releasesTable.draft, false)))
        .limit(1),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'releases'
      })
  })

const fetchLabel = (labelId: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select({
          id: labelsTable.id,
          title: labelsTable.title
        })
        .from(labelsTable)
        .where(eq(labelsTable.id, labelId))
        .limit(1),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'labels'
      })
  })

export const shareRelease = async (c: Context) => {
  const { slug } = c.req.param()

  if (!slug) {
    return c.html(
      buildErrorHtml({
        title: 'Invalid URL',
        message: 'The URL is missing a release slug.',
        statusCode: 400
      }),
      400
    )
  }

  const program = Effect.gen(function* () {
    const [release] = yield* fetchReleaseBySlug(slug)
    if (!release) {
      return yield* new NotFoundError({
        message: 'Release not found',
        resource: 'release',
        id: slug
      })
    }

    const [label] = yield* fetchLabel(release.labelId)

    return {
      html: buildOGHtml({
        type: 'music.album',
        title: release.title || slug,
        description: release.description || `Check out ${release.title || slug} on goosebumps.fm`,
        image: release.thumbnailUrl,
        canonicalPath: `/releases/${slug}`,
        creators: label ? [label.title] : undefined,
        imageAlt: `${release.title || slug} album art`
      }),
      status: 200
    } satisfies HtmlResponse
  }).pipe(
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed<HtmlResponse>({
        html: buildErrorHtml({
          title: 'Release not found',
          message: "The release you're looking for doesn't exist.",
          statusCode: 404
        }),
        status: 404
      })
    ),
    Effect.catchTag('DatabaseError', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[Share] Error fetching release', {
          slug,
          error: error.message
        })
        return {
          html: buildErrorHtml({
            title: 'Error',
            message: 'Something went wrong while loading this release.',
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
