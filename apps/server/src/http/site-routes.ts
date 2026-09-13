import type { SiteMetadataRouteKind } from '@gbfm/api/site-metadata'
import { and, eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServerResponse } from 'effect/unstable/http'
import { audioTable } from '@/db/audio.schema'
import { Database } from '@/db/layer'
import { DatabaseError, getErrorMessage } from '@/errors'
import { buildErrorHtml, buildShareHtml } from '@/routes/redirect/redirect.template'
import { getCachedSitemap } from '@/routes/redirect/seo/sitemap.service'
import { rssFeedHtml } from '@/routes/rss/rss.template'
import { ConfigService } from '@/services/config.service'
import { resolveSiteMetadata } from '@/services/site-metadata.service'

type HtmlResult = { readonly html: string; readonly status: 200 | 400 | 404 | 500 }

const htmlResponse = (result: HtmlResult) =>
  HttpServerResponse.text(result.html, {
    contentType: 'text/html',
    status: result.status,
    headers: result.status === 200 ? { 'cache-control': 'public, max-age=3600' } : undefined
  })

const missingParamResponse = (label: string) =>
  Effect.succeed(
    htmlResponse({
      html: buildErrorHtml({
        title: 'Invalid URL',
        message: `The URL is missing a ${label}.`,
        statusCode: 400
      }),
      status: 400
    })
  )

const notFoundResponse = (label: string) =>
  Effect.succeed<HtmlResult>({
    html: buildErrorHtml({
      title: `${label} not found`,
      message: `The ${label.toLowerCase()} you're looking for doesn't exist.`,
      statusCode: 404
    }),
    status: 404
  })

const shareRoute = (
  kind: SiteMetadataRouteKind,
  label: string,
  param: 'slug' | 'username' = 'slug'
) =>
  HttpRouter.params.pipe(
    Effect.flatMap((params) => {
      const identifier = params[param]
      if (!identifier)
        return missingParamResponse(param === 'username' ? 'username' : `${label} slug`)

      return resolveSiteMetadata(kind, identifier).pipe(
        Effect.map(
          (metadata) => ({ html: buildShareHtml(metadata), status: 200 }) satisfies HtmlResult
        ),
        Effect.catchTag('NotFoundError', () => notFoundResponse(label)),
        Effect.catchTag('DatabaseError', (error) =>
          Effect.gen(function* () {
            yield* Effect.logError(`[Share] Error fetching ${label.toLowerCase()}`, {
              identifier,
              error: error.message
            })
            return {
              html: buildErrorHtml({
                title: 'Error',
                message: `Something went wrong while loading this ${label.toLowerCase()}.`,
                statusCode: 500
              }),
              status: 500
            } satisfies HtmlResult
          })
        ),
        Effect.map(htmlResponse)
      )
    })
  )

const fetchDb = <A>(query: () => Promise<A>, table: string) =>
  Effect.tryPromise({
    try: query,
    catch: (cause) =>
      new DatabaseError({ message: getErrorMessage(cause), operation: 'select', table })
  })

const rssXml = Effect.gen(function* () {
  const db = yield* Database
  const mixes = yield* fetchDb(
    () =>
      db
        .select()
        .from(audioTable)
        .where(and(eq(audioTable.type, 'mix'), eq(audioTable.draft, false))),
    'audio'
  )
  return HttpServerResponse.text(rssFeedHtml(mixes), {
    contentType: 'text/html',
    headers: { 'cache-control': 'public, max-age=3600' }
  })
}).pipe(
  Effect.catchTag('DatabaseError', (error) =>
    Effect.gen(function* () {
      yield* Effect.logError('[RSS] Error generating RSS feed', { error: error.message })
      return HttpServerResponse.text('Internal Server Error', { status: 500 })
    })
  )
)

const faviconIco = Effect.sync(() =>
  HttpServerResponse.text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" x="-0.1em" font-size="90">🪿</text></svg>',
    { contentType: 'image/svg+xml' }
  )
)

const robotsTxt = Effect.gen(function* () {
  const config = yield* ConfigService
  const siteUrl = config.urls.frontend.replace(/\/$/, '')
  return HttpServerResponse.text(
    `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# Sitemaps
Sitemap: ${siteUrl}/sitemap.xml
`,
    {
      contentType: 'text/plain; charset=utf-8',
      headers: { 'cache-control': 'public, max-age=86400' }
    }
  )
})

const EMPTY_SITEMAP =
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'

const sitemapXml = getCachedSitemap.pipe(
  Effect.map(({ xml, generatedAt }) =>
    HttpServerResponse.text(xml, {
      contentType: 'application/xml; charset=utf-8',
      headers: {
        'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
        'last-modified': generatedAt.toUTCString()
      }
    })
  ),
  Effect.catch((error) =>
    Effect.gen(function* () {
      yield* Effect.logError('[Sitemap] Error getting sitemap', {
        error: error instanceof Error ? error.message : String(error)
      })
      return HttpServerResponse.text(EMPTY_SITEMAP, {
        contentType: 'application/xml; charset=utf-8',
        status: 500
      })
    })
  )
)

export const SiteRoutesLive = Layer.mergeAll(
  HttpRouter.add('GET', '/s/mix/:slug', shareRoute('mix', 'Mix')),
  HttpRouter.add('GET', '/s/track/:slug', shareRoute('track', 'Track')),
  HttpRouter.add('GET', '/s/show/:slug', shareRoute('show', 'Show')),
  HttpRouter.add('GET', '/s/profile/:username', shareRoute('profile', 'Profile', 'username')),
  HttpRouter.add('GET', '/s/release/:slug', shareRoute('release', 'Release')),
  HttpRouter.add('GET', '/s/label/:slug', shareRoute('label', 'Label')),
  HttpRouter.add('GET', '/s/post/:slug', shareRoute('post', 'Post')),
  HttpRouter.add('GET', '/s/editorial/:slug', shareRoute('editorial', 'Post')),
  HttpRouter.add('GET', '/s/tweet/:slug', shareRoute('tweet', 'Post')),
  HttpRouter.add('GET', '/s/:slug', shareRoute('slug', 'Page')),
  HttpRouter.add('GET', '/robots.txt', robotsTxt),
  HttpRouter.add('GET', '/sitemap.xml', sitemapXml),
  HttpRouter.add('GET', '/rss.xml', rssXml),
  HttpRouter.add('GET', '/favicon.ico', faviconIco)
)
