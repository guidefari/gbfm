import { Effect } from 'effect'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { runApp } from '@/runtime'
import { type ResolveResult, ResolveService } from '@/services/resolve.service'
import { buildErrorHtml, buildOGHtml } from '../redirect.template'

type HtmlResponse = { html: string; status: ContentfulStatusCode }

const buildSuccessResponse = (
  resolved: ResolveResult,
  slug: string
): HtmlResponse => {
  if (resolved.type === 'profile') {
    const { data } = resolved
    const displayName = data.displayUsername || data.username || 'Unknown User'
    return {
      html: buildOGHtml({
        type: 'profile',
        title: displayName,
        description: `Check out ${displayName}'s profile on goosebumps.fm`,
        image: data.image,
        canonicalPath: `/${data.username}`,
        imageAlt: `${displayName}'s profile picture`
      }),
      status: 200
    }
  }

  if (resolved.type === 'show') {
    const { data } = resolved
    return {
      html: buildOGHtml({
        type: 'website',
        title: data.title || slug,
        description:
          data.description ||
          `Check out ${data.title || slug} on goosebumps.fm`,
        image: data.bannerImageUrl || data.thumbnailUrl,
        canonicalPath: `/${data.slug}`,
        creators: data.hosts.map((h) => h.name),
        imageAlt: `${data.title || slug} show art`
      }),
      status: 200
    }
  }

  return {
    html: buildErrorHtml({
      title: 'Not found',
      message: "The page you're looking for doesn't exist.",
      statusCode: 404
    }),
    status: 404
  }
}

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
  }).pipe(
    Effect.map((resolved) => buildSuccessResponse(resolved, slug)),
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed<HtmlResponse>({
        html: buildErrorHtml({
          title: 'Not found',
          message: "The page you're looking for doesn't exist.",
          statusCode: 404
        }),
        status: 404
      })
    ),
    Effect.catchTag('DatabaseError', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[Share] Database error resolving slug', {
          slug,
          error: error.message
        })
        return {
          html: buildErrorHtml({
            title: 'Error',
            message: 'Something went wrong while loading this page.',
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
