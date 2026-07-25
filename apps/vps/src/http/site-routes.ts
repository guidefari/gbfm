import { and, eq, exists, lte } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServerResponse } from 'effect/unstable/http'
import { db } from '@/db'
import { audioCreators, audioTable } from '@/db/audio.schema'
import { rssFeedHtml } from '@/routes/rss/rss.template'
import { user as usersTable } from '@/db/auth.schema'
import { musicLabelCreatorsTable, musicLabelsTable } from '@/db/music-entity.schema'
import { postCreators, postsTable } from '@/db/post.schema'
import { releasesTable } from '@/db/release.schema'
import { showCreators, showsTable } from '@/db/show.schema'
import { DatabaseError, NotFoundError } from '@/errors'
import { buildErrorHtml, buildOGHtml } from '@/routes/redirect/redirect.template'
import { getCachedSitemap } from '@/routes/redirect/seo/sitemap.service'
import { ResolveService } from '@/services/resolve.service'
import { config } from '@/services/config.service'

// These are externally-referenced public URLs (RSS readers, share links,
// search-engine crawlers) -- kept as plain HttpRouter routes, not
// HttpApiEndpoint, matching docs/migration-effect-http-api.md's guidance
// that HTML/XML/redirect responses shouldn't be forced into the JSON-first
// HttpApi encoding. redirect.template.ts and seo/sitemap.service.ts (+
// sitemap.utils.ts) are pure, framework-agnostic modules with no Hono
// dependency -- reused here unchanged from their existing location, and
// still imported unchanged by apps/vps/src/app.ts for the background
// sitemap-regeneration fork.

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

const errorResponse =
  (logTag: string, label: string, slugOrUsername: string) => (error: DatabaseError) =>
    Effect.gen(function* () {
      yield* Effect.logError(`[Share] Error fetching ${label.toLowerCase()}`, {
        slug: slugOrUsername,
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

const fetchDb = <A>(query: () => Promise<A>, table: string) =>
  Effect.tryPromise({
    try: query,
    catch: (error) => new DatabaseError({ message: String(error), operation: 'select', table })
  })

const shareMix = HttpRouter.params.pipe(
  Effect.flatMap((params) => {
    const slug = params.slug
    if (!slug) return missingParamResponse('mix slug')

    const program = Effect.gen(function* () {
      const [audio] = yield* fetchDb(
        () =>
          db
            .select()
            .from(audioTable)
            .where(
              and(
                eq(audioTable.type, 'mix'),
                eq(audioTable.slug, slug),
                eq(audioTable.draft, false)
              )
            )
            .limit(1),
        'audio'
      )
      if (!audio)
        return yield* new NotFoundError({ message: 'Mix not found', resource: 'mix', id: slug })

      const creators = yield* fetchDb(
        () =>
          db
            .select({ id: usersTable.id, name: usersTable.name })
            .from(audioCreators)
            .innerJoin(usersTable, eq(audioCreators.creatorId, usersTable.id))
            .where(eq(audioCreators.audioId, audio.id)),
        'audio_creators'
      )

      return {
        html: buildOGHtml({
          type: 'music.song',
          title: audio.title || slug,
          description: audio.description || `Listen to ${audio.title || slug} on goosebumps.fm`,
          image: audio.thumbnailUrl,
          canonicalPath: `/mixes/${slug}`,
          audio: audio.url,
          creators: creators.map((c) => c.name),
          imageAlt: `${audio.title || slug} cover art`
        }),
        status: 200
      } satisfies HtmlResult
    }).pipe(
      Effect.catchTag('NotFoundError', () => notFoundResponse('Mix')),
      Effect.catchTag('DatabaseError', errorResponse('Share', 'Mix', slug))
    )

    return program.pipe(Effect.map(htmlResponse))
  })
)

const shareTrack = HttpRouter.params.pipe(
  Effect.flatMap((params) => {
    const slug = params.slug
    if (!slug) return missingParamResponse('track slug')

    const program = Effect.gen(function* () {
      const [audio] = yield* fetchDb(
        () =>
          db
            .select()
            .from(audioTable)
            .where(
              and(
                eq(audioTable.type, 'track'),
                eq(audioTable.slug, slug),
                eq(audioTable.draft, false)
              )
            )
            .limit(1),
        'audio'
      )
      if (!audio)
        return yield* new NotFoundError({ message: 'Track not found', resource: 'track', id: slug })

      const creators = yield* fetchDb(
        () =>
          db
            .select({ id: usersTable.id, name: usersTable.name })
            .from(audioCreators)
            .innerJoin(usersTable, eq(audioCreators.creatorId, usersTable.id))
            .where(eq(audioCreators.audioId, audio.id)),
        'audio_creators'
      )

      return {
        html: buildOGHtml({
          type: 'music.song',
          title: audio.title || slug,
          description: audio.description || `Listen to ${audio.title || slug} on goosebumps.fm`,
          image: audio.thumbnailUrl,
          canonicalPath: `/tracks/${slug}`,
          audio: audio.url,
          creators: creators.map((c) => c.name),
          imageAlt: `${audio.title || slug} cover art`
        }),
        status: 200
      } satisfies HtmlResult
    }).pipe(
      Effect.catchTag('NotFoundError', () => notFoundResponse('Track')),
      Effect.catchTag('DatabaseError', errorResponse('Share', 'Track', slug))
    )

    return program.pipe(Effect.map(htmlResponse))
  })
)

const shareShow = HttpRouter.params.pipe(
  Effect.flatMap((params) => {
    const slug = params.slug
    if (!slug) return missingParamResponse('show slug')

    const program = Effect.gen(function* () {
      const [show] = yield* fetchDb(
        () =>
          db
            .select()
            .from(showsTable)
            .where(and(eq(showsTable.slug, slug), eq(showsTable.draft, false)))
            .limit(1),
        'shows'
      )
      if (!show)
        return yield* new NotFoundError({ message: 'Show not found', resource: 'show', id: slug })

      const hosts = yield* fetchDb(
        () =>
          db
            .select({ id: usersTable.id, name: usersTable.name })
            .from(showCreators)
            .innerJoin(usersTable, eq(showCreators.creatorId, usersTable.id))
            .where(eq(showCreators.showId, show.id)),
        'show_creators'
      )

      return {
        html: buildOGHtml({
          type: 'website',
          title: show.title || slug,
          description: show.description || `Check out ${show.title || slug} on goosebumps.fm`,
          image: show.bannerImageUrl || show.thumbnailUrl,
          canonicalPath: `/shows/${slug}`,
          creators: hosts.map((h) => h.name),
          imageAlt: `${show.title || slug} show art`
        }),
        status: 200
      } satisfies HtmlResult
    }).pipe(
      Effect.catchTag('NotFoundError', () => notFoundResponse('Show')),
      Effect.catchTag('DatabaseError', errorResponse('Share', 'Show', slug))
    )

    return program.pipe(Effect.map(htmlResponse))
  })
)

const shareProfile = HttpRouter.params.pipe(
  Effect.flatMap((params) => {
    const username = params.username
    if (!username) return missingParamResponse('username')

    const program = Effect.gen(function* () {
      const [user] = yield* fetchDb(
        () =>
          db
            .select({
              id: usersTable.id,
              name: usersTable.name,
              username: usersTable.username,
              image: usersTable.image,
              banned: usersTable.banned
            })
            .from(usersTable)
            .where(eq(usersTable.username, username))
            .limit(1),
        'user'
      )
      if (!user || user.banned) {
        return yield* new NotFoundError({
          message: 'Profile not found',
          resource: 'profile',
          id: username
        })
      }

      return {
        html: buildOGHtml({
          type: 'profile',
          title: user.name,
          description: `Check out ${user.name}'s profile on goosebumps.fm`,
          image: user.image,
          canonicalPath: `/${user.username}`,
          imageAlt: `${user.name}'s profile picture`
        }),
        status: 200
      } satisfies HtmlResult
    }).pipe(
      Effect.catchTag('NotFoundError', () => notFoundResponse('Profile')),
      Effect.catchTag('DatabaseError', errorResponse('Share', 'Profile', username))
    )

    return program.pipe(Effect.map(htmlResponse))
  })
)

const shareRelease = HttpRouter.params.pipe(
  Effect.flatMap((params) => {
    const slug = params.slug
    if (!slug) return missingParamResponse('release slug')

    const program = Effect.gen(function* () {
      const [release] = yield* fetchDb(
        () =>
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
              and(
                eq(releasesTable.slug, slug),
                eq(releasesTable.draft, false),
                exists(
                  db
                    .select({ id: musicLabelsTable.id })
                    .from(musicLabelsTable)
                    .where(
                      and(
                        eq(musicLabelsTable.id, releasesTable.labelId),
                        lte(musicLabelsTable.publishedAt, new Date())
                      )
                    )
                )
              )
            )
            .limit(1),
        'releases'
      )
      if (!release) {
        return yield* new NotFoundError({
          message: 'Release not found',
          resource: 'release',
          id: slug
        })
      }

      const [label] = yield* fetchDb(
        () =>
          db
            .select({ id: musicLabelsTable.id, name: musicLabelsTable.name })
            .from(musicLabelsTable)
            .where(eq(musicLabelsTable.id, release.labelId))
            .limit(1),
        'labels'
      )

      return {
        html: buildOGHtml({
          type: 'music.album',
          title: release.title || slug,
          description: release.description || `Check out ${release.title || slug} on goosebumps.fm`,
          image: release.thumbnailUrl,
          canonicalPath: `/releases/${slug}`,
          creators: label ? [label.name] : undefined,
          imageAlt: `${release.title || slug} album art`
        }),
        status: 200
      } satisfies HtmlResult
    }).pipe(
      Effect.catchTag('NotFoundError', () => notFoundResponse('Release')),
      Effect.catchTag('DatabaseError', errorResponse('Share', 'Release', slug))
    )

    return program.pipe(Effect.map(htmlResponse))
  })
)

const shareLabel = HttpRouter.params.pipe(
  Effect.flatMap((params) => {
    const slug = params.slug
    if (!slug) return missingParamResponse('label slug')

    const program = Effect.gen(function* () {
      const [label] = yield* fetchDb(
        () =>
          db
            .select()
            .from(musicLabelsTable)
            .where(
              and(eq(musicLabelsTable.slug, slug), lte(musicLabelsTable.publishedAt, new Date()))
            )
            .limit(1),
        'labels'
      )
      if (!label)
        return yield* new NotFoundError({ message: 'Label not found', resource: 'label', id: slug })

      const creators = yield* fetchDb(
        () =>
          db
            .select({ id: usersTable.id, name: usersTable.name })
            .from(musicLabelCreatorsTable)
            .innerJoin(usersTable, eq(musicLabelCreatorsTable.creatorId, usersTable.id))
            .where(eq(musicLabelCreatorsTable.labelId, label.id)),
        'music_label_creators'
      )

      const description = label.description || `Check out ${label.name || slug} on goosebumps.fm`
      const genresSuffix =
        label.genres && label.genres.length > 0 ? ` | Genres: ${label.genres.join(', ')}` : ''

      return {
        html: buildOGHtml({
          type: 'website',
          title: label.name || slug,
          description: description + genresSuffix,
          image: label.imageUrl,
          canonicalPath: `/labels/${slug}`,
          creators: creators.map((c) => c.name),
          imageAlt: `${label.name || slug} label art`
        }),
        status: 200
      } satisfies HtmlResult
    }).pipe(
      Effect.catchTag('NotFoundError', () => notFoundResponse('Label')),
      Effect.catchTag('DatabaseError', errorResponse('Share', 'Label', slug))
    )

    return program.pipe(Effect.map(htmlResponse))
  })
)

const sharePost = HttpRouter.params.pipe(
  Effect.flatMap((params) => {
    const slug = params.slug
    if (!slug) return missingParamResponse('post slug')

    const program = Effect.gen(function* () {
      const [post] = yield* fetchDb(
        () =>
          db
            .select()
            .from(postsTable)
            .where(and(eq(postsTable.slug, slug), eq(postsTable.draft, false)))
            .limit(1),
        'posts'
      )
      if (!post)
        return yield* new NotFoundError({ message: 'Post not found', resource: 'post', id: slug })

      const creators = yield* fetchDb(
        () =>
          db
            .select({ id: usersTable.id, name: usersTable.name })
            .from(postCreators)
            .innerJoin(usersTable, eq(postCreators.creatorId, usersTable.id))
            .where(eq(postCreators.postId, post.id)),
        'post_creators'
      )

      const canonicalPath = post.type === 'micro' ? `/tweet/${slug}` : `/editorial/${slug}`

      return {
        html: buildOGHtml({
          type: 'article',
          title: post.title || slug,
          description: post.description || `Read ${post.title || slug} on goosebumps.fm`,
          image: post.thumbnailUrl,
          canonicalPath,
          creators: creators.map((c) => c.name),
          imageAlt: `${post.title || slug} thumbnail`
        }),
        status: 200
      } satisfies HtmlResult
    }).pipe(
      Effect.catchTag('NotFoundError', () => notFoundResponse('Post')),
      Effect.catchTag('DatabaseError', errorResponse('Share', 'Post', slug))
    )

    return program.pipe(Effect.map(htmlResponse))
  })
)

const shareSlug = HttpRouter.params.pipe(
  Effect.flatMap((params) => {
    const slug = params.slug
    if (!slug) return missingParamResponse('slug')

    const program = Effect.gen(function* () {
      const resolveService = yield* ResolveService
      const resolved = yield* resolveService.resolve(slug)

      if (resolved.type === 'profile') {
        const { data } = resolved
        return {
          html: buildOGHtml({
            type: 'profile',
            title: data.name,
            description: `Check out ${data.name}'s profile on goosebumps.fm`,
            image: data.image,
            canonicalPath: `/${data.username}`,
            imageAlt: `${data.name}'s profile picture`
          }),
          status: 200
        } satisfies HtmlResult
      }

      if (resolved.type === 'show') {
        const { data } = resolved
        return {
          html: buildOGHtml({
            type: 'website',
            title: data.title || slug,
            description: data.description || `Check out ${data.title || slug} on goosebumps.fm`,
            image: data.bannerImageUrl || data.thumbnailUrl,
            canonicalPath: `/${data.slug}`,
            creators: data.hosts.map((h) => h.name),
            imageAlt: `${data.title || slug} show art`
          }),
          status: 200
        } satisfies HtmlResult
      }

      return {
        html: buildErrorHtml({
          title: 'Not found',
          message: "The page you're looking for doesn't exist.",
          statusCode: 404
        }),
        status: 404
      } satisfies HtmlResult
    }).pipe(
      Effect.catchTag('NotFoundError', () => notFoundResponse('Page')),
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
          } satisfies HtmlResult
        })
      )
    )

    return program.pipe(Effect.map(htmlResponse))
  })
)

const rssXml = Effect.gen(function* () {
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

// Replaces stoker/middlewares's serveEmojiFavicon('🪿') -- was global
// middleware in the old Hono app (checked path === '/favicon.ico' on every
// request), ported as its own route since a single static path doesn't need
// per-request middleware overhead.
const faviconIco = Effect.sync(() =>
  HttpServerResponse.text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" x="-0.1em" font-size="90">🪿</text></svg>',
    { contentType: 'image/svg+xml' }
  )
)

const robotsTxt = Effect.sync(() => {
  const siteUrl = config.urls.frontend.replace(/\/$/, '')
  const robots = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# Sitemaps
Sitemap: ${siteUrl}/sitemap.xml
`
  return HttpServerResponse.text(robots, {
    contentType: 'text/plain; charset=utf-8',
    headers: { 'cache-control': 'public, max-age=86400' }
  })
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
  HttpRouter.add('GET', '/s/mix/:slug', shareMix),
  HttpRouter.add('GET', '/s/track/:slug', shareTrack),
  HttpRouter.add('GET', '/s/show/:slug', shareShow),
  HttpRouter.add('GET', '/s/profile/:username', shareProfile),
  HttpRouter.add('GET', '/s/release/:slug', shareRelease),
  HttpRouter.add('GET', '/s/label/:slug', shareLabel),
  HttpRouter.add('GET', '/s/post/:slug', sharePost),
  HttpRouter.add('GET', '/s/editorial/:slug', sharePost),
  HttpRouter.add('GET', '/s/tweet/:slug', sharePost),
  // Catch-all must stay registered last -- find-my-way (HttpRouter's
  // matcher) already gives static/parametric routes precedence over a
  // single-segment wildcard, matching the old Hono router's ordering
  // comment, but keeping it last in this list still matters for readability
  // and for `robots.txt`/`sitemap.xml` static-file `Allow`-listing hygiene.
  HttpRouter.add('GET', '/s/:slug', shareSlug),
  HttpRouter.add('GET', '/robots.txt', robotsTxt),
  HttpRouter.add('GET', '/sitemap.xml', sitemapXml),
  HttpRouter.add('GET', '/rss.xml', rssXml),
  HttpRouter.add('GET', '/favicon.ico', faviconIco)
)
