import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Context } from 'hono'
import { db } from '@/db'
import { labelsTable } from '@/db/label.schema'
import { releasesTable } from '@/db/release.schema'
import { DatabaseError } from '@/errors'
import { runApp } from '@/runtime'
import { buildErrorHtml, buildOGHtml } from '../redirect.template'

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
        .where(
          and(eq(releasesTable.slug, slug), eq(releasesTable.draft, false))
        )
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
      return { found: false } as const
    }

    const [label] = yield* fetchLabel(release.labelId)
    return { found: true, release, label } as const
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    Effect.logError('[Share] Error fetching release', {
      slug,
      error:
        result.left instanceof Error ? result.left.message : String(result.left)
    }).pipe(Effect.runPromise)

    return c.html(
      buildErrorHtml({
        title: 'Error',
        message: 'Something went wrong while loading this release.',
        statusCode: 500
      }),
      500
    )
  }

  const data = result.right
  if (!data.found) {
    return c.html(
      buildErrorHtml({
        title: 'Release not found',
        message: "The release you're looking for doesn't exist.",
        statusCode: 404
      }),
      404
    )
  }

  const { release, label } = data

  const html = buildOGHtml({
    type: 'music.album',
    title: release.title || slug,
    description:
      release.description ||
      `Check out ${release.title || slug} on goosebumps.fm`,
    image: release.thumbnailUrl,
    canonicalPath: `/releases/${slug}`,
    creators: label ? [label.title] : undefined,
    imageAlt: `${release.title || slug} album art`
  })

  c.header('Cache-Control', 'public, max-age=3600')
  return c.html(html)
}
