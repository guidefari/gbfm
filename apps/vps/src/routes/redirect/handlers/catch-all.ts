import { Effect } from 'effect'
import type { Context } from 'hono'
import { runApp } from '@/runtime'
import { ResolveService } from '@/services/resolve.service'
import { buildErrorHtml, buildOGHtml } from '../redirect.template'

export const shareSlug = async (c: Context) => {
  const { slug } = c.req.param()

  if (!slug) {
    return c.html(
      buildErrorHtml({
        title: 'Invalid URL',
        message: 'The URL is missing a slug.',
        statusCode: 400
      }),
      400
    )
  }

  const program = Effect.gen(function* () {
    const resolveService = yield* ResolveService
    return yield* resolveService.resolve(slug)
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    // Check if it's a NotFoundError
    if (error && typeof error === 'object' && '_tag' in error) {
      if (error._tag === 'NotFoundError') {
        return c.html(
          buildErrorHtml({
            title: 'Not found',
            message: "The page you're looking for doesn't exist.",
            statusCode: 404
          }),
          404
        )
      }
    }

    Effect.logError('[Share] Error resolving slug', {
      slug,
      error: error instanceof Error ? error.message : String(error)
    }).pipe(Effect.runPromise)

    return c.html(
      buildErrorHtml({
        title: 'Error',
        message: 'Something went wrong while loading this page.',
        statusCode: 500
      }),
      500
    )
  }

  const resolved = result.right

  if (resolved.type === 'profile') {
    const { data } = resolved
    const displayName = data.displayUsername || data.username || 'Unknown User'

    const html = buildOGHtml({
      type: 'profile',
      title: displayName,
      description: `Check out ${displayName}'s profile on goosebumps.fm`,
      image: data.image,
      canonicalPath: `/${data.username}`,
      imageAlt: `${displayName}'s profile picture`
    })

    c.header('Cache-Control', 'public, max-age=3600')
    return c.html(html)
  }

  if (resolved.type === 'show') {
    const { data } = resolved

    const html = buildOGHtml({
      type: 'website',
      title: data.title || slug,
      description:
        data.description || `Check out ${data.title || slug} on goosebumps.fm`,
      image: data.bannerImageUrl || data.thumbnailUrl,
      canonicalPath: `/${data.slug}`,
      creators: data.hosts.map((h) => h.name),
      imageAlt: `${data.title || slug} show art`
    })

    c.header('Cache-Control', 'public, max-age=3600')
    return c.html(html)
  }

  // Fallback (shouldn't happen but just in case)
  return c.html(
    buildErrorHtml({
      title: 'Not found',
      message: "The page you're looking for doesn't exist.",
      statusCode: 404
    }),
    404
  )
}
