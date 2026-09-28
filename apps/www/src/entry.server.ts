import { GetFavoritesResponse } from '@gbfm/api/favorites'
import { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import { GetPostTagsResponse, GetPostsByTagResponse, MicroPostScreenResponse } from '@gbfm/api/post'
import { PublicProfileResponse } from '@gbfm/api/profile'
import { ResolveResult } from '@gbfm/api/resolve'
import {
  GetAllShowsResponse,
  GetShowEpisodesResponse,
  ShowSubscriptionStatusResponse,
} from '@gbfm/api/shows'
import { ListDjsResponse } from '@gbfm/api/user'
import { submitLocalRequestLog } from '@gbfm/core/observability/local-loki'
import { resolveRequestId } from '@gbfm/core/observability/request-id'
import { RichContentDocument } from '@gbfm/rich-content/schema'
import {
  makeStaticSiteMetadata,
  renderDocumentHead,
  SiteMetadata,
  SITE_URL,
} from '@gbfm/site-metadata'
import { Effect, Option, Schema } from 'effect'
import * as Server from 'foldkit/experimental/server'
import template from 'virtual:gbfm-document'
import changelog from 'virtual:repo-changelog'

import {
  applicationConfig,
  ContentItem,
  type Flags,
  parseRoute,
  Principal,
  Route,
} from './application'
import { parseDashboardDocument } from './dashboard/document'
import { endpointFor as dashboardEndpointFor, isAdminSection } from './dashboard/model'
import type { Document as PublicActionDocument } from './public-actions'
import { apiRequest, endpointFor } from './server/api'
import { handleFormAction, redirect } from './server/form-actions'
import type { ShowsDocument } from './shows'
import { staticPages } from './static-pages'
import { routeTemplate } from './telemetry/privacy'
import { handleBrowserTelemetry } from './telemetry/server'
import { skipsSeenTweets } from './tweet-navigation'

export { apiRequest, endpointFor }

const JsonObject = Schema.Record(Schema.String, Schema.Json)

const record = (value: Schema.Json | undefined) =>
  Option.getOrNull(Schema.decodeUnknownOption(JsonObject)(value))

const text = (value: Schema.Json | undefined, fallback = '') =>
  Option.getOrElse(Schema.decodeUnknownOption(Schema.String)(value), () => fallback)

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const contentItems = (payload: Schema.Json, path: string): ReadonlyArray<ContentItem> => {
  const container = record(payload)

  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(container?.data)
      ? container.data
      : [payload]

  return candidates.flatMap((value) => {
    const item = record(value)

    if (!item) return []
    const slug = text(item.slug, text(item.id))
    const content = text(item.content)

    const richContent = Option.getOrNull(
      Schema.decodeUnknownOption(RichContentDocument)(item.richContent),
    )

    const title = text(item.title, text(item.name, text(item.username, content.slice(0, 80))))

    if (!slug) return []

    return [
      {
        id: text(item.id, slug),
        slug,
        title,
        content,
        richContent,
        description: text(item.description, text(item.bio)) || null,
        imageUrl: text(item.thumbnailUrl, text(item.imageUrl, text(item.image))) || null,
        audioUrl: text(item.url) || null,
        audioType: Option.getOrNull(
          Schema.decodeUnknownOption(ContentItem.fields.audioType)(item.type),
        ),
        creators: Option.getOrUndefined(
          Schema.decodeUnknownOption(ContentItem.fields.creators)(item.creators),
        ),
        tags: Option.getOrNull(Schema.decodeUnknownOption(ContentItem.fields.tags)(item.tags)),
        streamingLinks: Option.getOrNull(
          Schema.decodeUnknownOption(ContentItem.fields.streamingLinks)(item.streamingLinks),
        ),
        href: `${path}/${encodeURIComponent(slug)}`,
        meta: text(item.releaseDate, text(item.createdAt)) || null,
      },
    ]
  })
}

const json = async (response: Response): Promise<Schema.Json> =>
  Schema.decodeUnknownSync(Schema.Json)(await response.json())

const publicActionState = async (
  request: Request,
  target: PublicActionDocument['target'],
): Promise<PublicActionDocument['state']> => {
  if (target.kind === 'show') {
    const response = await apiRequest(
      request,
      `/api/shows/${encodeURIComponent(target.id)}/subscription`,
      {
        method: 'GET',
      },
    )

    if (!response.ok) return 'unavailable'

    const status = Schema.decodeUnknownSync(ShowSubscriptionStatusResponse)(await response.json())

    return status.subscribed ? 'active' : 'inactive'
  }

  let offset = 0

  while (true) {
    const response = await apiRequest(request, `/api/favorites?limit=100&offset=${offset}`, {
      method: 'GET',
    })

    if (!response.ok) return 'unavailable'

    const result = Schema.decodeUnknownSync(GetFavoritesResponse)(await response.json())

    if (result.favorites.some((favorite) => favorite.audioId === target.id)) return 'active'
    offset += result.favorites.length

    if (!result.favorites.length || offset >= result.total) return 'inactive'
  }
}

const session = async (request: Request) => {
  if (
    !request.headers.get('cookie')?.includes('session_token=') &&
    !request.headers.has('authorization')
  )
    return { principal: null, cookies: [] }
  const response = await apiRequest(request, '/auth/get-session', { method: 'GET' })
  const payload = record(await json(response))
  const user = record(payload?.user)

  const principal = user
    ? Schema.decodeUnknownSync(Principal)({
        id: text(user.id),
        name: text(user.name) || null,
        username: text(user.username) || null,
        role: text(user.role, 'user'),
      })
    : null

  return { principal, cookies: response.headers.getSetCookie() }
}

const renderResponse = async (request: Request): Promise<Server.Responded> => {
  const startedAt = performance.now()
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto')

  // Foldkit's Vite adapter uses localhost as its URL base; preserve the incoming dev origin.
  if (import.meta.env.DEV && host) {
    const origin = URL.parse(`${(protocol ?? url.protocol).replace(':', '')}://${host}`)

    if (origin) {
      url.protocol = origin.protocol
      url.hostname = origin.hostname
      url.port = origin.port
    }
  }

  const route = parseRoute(url.pathname)
  const dataRequest = url.searchParams.has('__data')
  url.searchParams.delete('__data')
  const requestId = resolveRequestId(request.headers.get('x-request-id'))
  const ownedRequest = new Request(url, request)
  ownedRequest.headers.set('x-request-id', requestId)

  if (url.pathname === '/telemetry/browser') {
    if (!import.meta.env.PROD) return Server.Responded(new Response(null, { status: 204 }))
    const { env } = await import('cloudflare:workers')

    return Server.Responded(
      await handleBrowserTelemetry(ownedRequest, {
        ...env,
        BROWSER_TELEMETRY_ORIGIN: url.origin,
      }),
    )
  }

  if (url.pathname.startsWith('/social/cards/') || url.pathname.startsWith('/social/tweets/')) {
    if (!import.meta.env.PROD) return Server.Responded(new Response(null, { status: 404 }))
    const { env } = await import('cloudflare:workers')

    return Server.Responded(await env.SOCIAL_IMAGES.fetch(ownedRequest))
  }

  if (
    request.method === 'POST' &&
    (Route.guards.Auth(route) || url.pathname.startsWith('/actions/'))
  )
    return handleFormAction(ownedRequest)

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/s/') ||
    (url.pathname === '/auth/verify-email' && url.searchParams.has('token')) ||
    (url.pathname.startsWith('/auth/') && !Route.guards.Auth(route)) ||
    ['/rss.xml', '/sitemap.xml'].includes(url.pathname)
  )
    return Server.Responded(await apiRequest(ownedRequest, `${url.pathname}${url.search}`))

  if (!['GET', 'HEAD'].includes(request.method))
    return Server.Responded(new Response(null, { status: 405 }))

  const redirectPage = (path: string) => {
    const target = new URL(path, url)

    if (dataRequest) target.searchParams.set('__data', '1')

    return redirect(`${target.pathname}${target.search}`)
  }

  if (['/tweet/latest', '/tweet'].includes(url.pathname)) return redirectPage('/tweets')

  if (url.pathname === '/tweet/new') return redirectPage('/new/tweet')

  if (url.pathname === '/tweets' && !url.searchParams.has('q')) {
    const latest = await apiRequest(ownedRequest, '/api/content/posts/micro/latest', {
      method: 'GET',
    })

    const slug = text(record(await json(latest))?.slug)

    if (slug) return redirectPage(`/tweet/${encodeURIComponent(slug)}`)
  }

  const endpoint = endpointFor(route)
  const showDetailSlug = Route.guards.Detail(route) && route.kind === 'shows' ? route.slug : null
  const tweetSlug = Route.guards.Detail(route) && route.kind === 'tweets' ? route.slug : null

  const optionalPageRequest = (path: string) =>
    Effect.tryPromise(() => apiRequest(ownedRequest, path, { method: 'GET' })).pipe(
      Effect.orElseSucceed(() => null),
    )

  const showEndpointRequest =
    endpoint && ((Route.guards.Listing(route) && route.kind === 'shows') || showDetailSlug !== null)
      ? Effect.runPromise(optionalPageRequest(endpoint))
      : null

  const tweetRequests =
    tweetSlug && endpoint
      ? Effect.runPromise(
          Effect.all(
            {
              screen: optionalPageRequest(endpoint),
              neighbours: optionalPageRequest(
                `/api/content/posts/micro/${encodeURIComponent(tweetSlug)}/neighbours`,
              ),
              metadata: optionalPageRequest(
                `/api/site-metadata/tweet/${encodeURIComponent(tweetSlug)}`,
              ),
            },
            { concurrency: 'unbounded' },
          ),
        )
      : null

  const showDetailRequests = showDetailSlug
    ? Effect.runPromise(
        Effect.all(
          {
            list: optionalPageRequest('/api/shows?limit=100&offset=0'),
            episodes: optionalPageRequest(
              `/api/shows/${encodeURIComponent(showDetailSlug)}/episodes?limit=100&offset=0`,
            ),
            metadata: optionalPageRequest(
              `/api/site-metadata/show/${encodeURIComponent(showDetailSlug)}`,
            ),
          },
          { concurrency: 'unbounded' },
        ),
      )
    : null

  const identity = await session(ownedRequest)

  const dashboardPath =
    Route.guards.Dashboard(route) &&
    identity.principal &&
    (!isAdminSection(route.section) || identity.principal.role === 'admin')
      ? dashboardEndpointFor(route.section, url.searchParams)
      : null

  const dashboard = dashboardPath
    ? await apiRequest(ownedRequest, dashboardPath, { method: 'GET' })
        .then(async (response) =>
          response.ok
            ? Effect.runPromise(parseDashboardDocument(dashboardPath, await response.json()))
            : null,
        )
        .catch(() => null)
    : null

  const tweetData = tweetRequests ? await tweetRequests : null

  const response = endpoint
    ? tweetData
      ? tweetData.screen
      : await (showEndpointRequest ??
          apiRequest(ownedRequest, endpoint, { method: 'GET' }).catch(() => null))
    : null

  const payload = response?.ok ? await json(response) : null
  const showDetailData = showDetailRequests ? await showDetailRequests : null

  const showMetadata =
    response?.ok && showDetailData?.metadata?.ok
      ? Option.getOrNull(
          Schema.decodeUnknownOption(SiteMetadata)(await showDetailData.metadata.json()),
        )
      : null

  const resolved =
    Route.guards.Detail(route) && route.kind === 'resolve' && payload
      ? Schema.decodeUnknownSync(ResolveResult)(payload)
      : null

  if (resolved?.type === 'show')
    return redirectPage(`/shows/${encodeURIComponent(resolved.data.slug)}`)

  const profile =
    resolved?.type === 'profile'
      ? resolved.data
      : Route.guards.Detail(route) && route.kind === 'profile' && payload
        ? Schema.decodeUnknownSync(PublicProfileResponse)(payload)
        : null

  const isTweet = tweetSlug !== null

  const tweet =
    isTweet && payload ? Schema.decodeUnknownSync(MicroPostScreenResponse)(payload) : null

  const neighbourResponse = tweetData?.neighbours ?? null

  const neighbours = neighbourResponse?.ok
    ? Option.getOrNull(
        Schema.decodeUnknownOption(MicroPostNeighboursResponse)(await json(neighbourResponse)),
      )
    : null

  const listPath = Route.guards.Home(route)
    ? '/mixes'
    : Route.guards.Detail(route)
      ? `/${route.kind === 'tweets' ? 'tweet' : route.kind}`
      : url.pathname

  const items =
    Route.guards.Listing(route) && route.kind === 'tags' && response?.ok
      ? contentItems(
          Schema.decodeUnknownSync(GetPostTagsResponse)(payload).map((tag) => ({
            id: tag,
            slug: tag,
            title: `#${tag}`,
          })),
          '/tags',
        )
      : Route.guards.Detail(route) && route.kind === 'tags' && response?.ok
        ? Schema.decodeUnknownSync(GetPostsByTagResponse)(payload).data.flatMap((post) =>
            contentItems(post, post.type === 'micro' ? '/tweet' : '/editorial'),
          )
        : Route.guards.Listing(route) && route.kind === 'djs' && response?.ok
          ? contentItems(
              Schema.decodeUnknownSync(ListDjsResponse)(payload).map((dj) => ({
                ...dj,
                slug: dj.username ?? dj.id,
              })),
              '/profile',
            )
          : contentItems(payload, listPath)

  let shows: ShowsDocument | null = null

  if (
    (Route.guards.Listing(route) || Route.guards.Detail(route)) &&
    route.kind === 'shows' &&
    response?.ok
  ) {
    const allResponse = Route.guards.Listing(route) ? response : (showDetailData?.list ?? null)

    const all = allResponse?.ok
      ? Schema.decodeUnknownSync(GetAllShowsResponse)(
          Route.guards.Listing(route) ? payload : await json(allResponse),
        )
      : null

    if (all) {
      const selectedSlug = Route.guards.Detail(route)
        ? route.slug
        : (url.searchParams.get('show') ?? all.data[0]?.slug ?? null)

      const episodesResponse = selectedSlug
        ? Route.guards.Detail(route)
          ? (showDetailData?.episodes ?? null)
          : await apiRequest(
              ownedRequest,
              `/api/shows/${encodeURIComponent(selectedSlug)}/episodes?limit=100&offset=0`,
              { method: 'GET' },
            ).catch(() => null)
        : null

      shows = {
        shows: all.data,
        selectedSlug,
        episodes: episodesResponse?.ok
          ? Schema.decodeUnknownSync(GetShowEpisodesResponse)(await json(episodesResponse))
          : null,
      }
    }
  }

  const selectedShow = shows?.shows.find((show) => show.slug === shows.selectedSlug)

  const audioItem =
    Route.guards.Detail(route) && ['mixes', 'tracks'].includes(route.kind) ? items[0] : undefined

  const actionTarget: PublicActionDocument['target'] | null = selectedShow
    ? { id: selectedShow.id, kind: 'show' }
    : audioItem
      ? { id: audioItem.id, kind: 'audio' }
      : null

  const publicAction: PublicActionDocument | null = actionTarget
    ? {
        target: actionTarget,
        path: `${url.pathname}${url.search}`,
        state: identity.principal
          ? await publicActionState(ownedRequest, actionTarget).catch(() => 'unavailable' as const)
          : 'anonymous',
      }
    : null

  const title =
    (Route.guards.Detail(route) && route.kind === 'tags' ? `#${route.slug}` : null) ??
    shows?.shows.find((show) => show.slug === shows.selectedSlug)?.title ??
    profile?.name ??
    tweet?.post.title ??
    tweet?.post.content?.slice(0, 80) ??
    (Route.guards.Detail(route) ? items[0]?.title : null) ??
    Route.match(route, {
      Home: () => 'goosebumps.fm',
      Listing: ({ kind }) =>
        kind === 'djs' ? 'DJs & Residents' : kind.charAt(0).toUpperCase() + kind.slice(1),
      Detail: () => 'Not found',
      Auth: () => 'Account',
      Composer: () => 'Create',
      Dashboard: () => 'Dashboard',
      Static: ({ page }) => staticPages.get(page)?.title ?? page,
      NotFound: () => 'Page not found',
    })

  const status =
    Route.guards.NotFound(route) || response?.status === 404
      ? 404
      : endpoint && !response?.ok
        ? 503
        : 200

  const flags: Flags = {
    url: url.pathname === '/spotify/callback' ? `${url.origin}${url.pathname}` : url.href,
    status,
    principal: identity.principal,
    items,
    title,
    description:
      Route.guards.Static(route) && route.page === 'invite/charlie3000'
        ? 'An invitation to contribute a guest mix to goosebumps.fm'
        : (tweet?.post.description ??
          items[0]?.description ??
          'Independent music, mixes and stories on goosebumps.fm.'),
    requestId,
    renderedAt: Date.now(),
    skipSeen: skipsSeenTweets(request.headers.get('cookie')),
    tweet,
    neighbours,
    dashboard,
    profile,
    shows,
    changelog: Route.guards.Static(route) && route.page === 'changelog' ? changelog : null,
    publicAction,
    metadata: null,
    failure: status === 503 ? 'Content is unavailable right now.' : null,
  }

  const headers = new Headers({
    'cache-control': 'private, no-store',
    'x-request-id': requestId,
    'server-timing': `foldkit;dur=${(performance.now() - startedAt).toFixed(1)}`,
  })

  for (const cookie of [
    ...identity.cookies,
    ...(response?.headers.getSetCookie() ?? []),
    ...(neighbourResponse?.headers.getSetCookie() ?? []),
  ])
    headers.append('set-cookie', cookie)

  const metadataKind = new Map([
    ['mixes', 'mix'],
    ['tracks', 'track'],
    ['shows', 'show'],
    ['tweets', 'tweet'],
    ['editorial', 'editorial'],
    ['releases', 'release'],
    ['labels', 'label'],
    ['profile', 'profile'],
  ])

  const kind = profile
    ? 'profile'
    : Route.guards.Detail(route)
      ? metadataKind.get(route.kind)
      : undefined

  const publicMetadata =
    showDetailSlug && response?.ok
      ? showMetadata
      : tweetData && status === 200
        ? await (tweetData.metadata?.ok
            ? tweetData.metadata
                .json()
                .then((value) => Option.getOrNull(Schema.decodeUnknownOption(SiteMetadata)(value)))
                .catch(() => null)
            : null)
        : kind && Route.guards.Detail(route) && status === 200
          ? await apiRequest(
              ownedRequest,
              `/api/site-metadata/${kind}/${encodeURIComponent(route.slug)}`,
              { method: 'GET' },
            )
              .then(async (response) =>
                response.ok
                  ? Option.getOrNull(
                      Schema.decodeUnknownOption(SiteMetadata)(await response.json()),
                    )
                  : null,
              )
              .catch(() => null)
          : null

  const sourceMetadata =
    publicMetadata ?? makeStaticSiteMetadata(title, flags.description, url.pathname)

  // Preview and dev origins must not become competing public canonical URLs.
  const metadata = {
    ...sourceMetadata,
    canonicalUrl: new URL(new URL(sourceMetadata.canonicalUrl).pathname, SITE_URL).href,
  }

  const readyFlags: Flags = { ...flags, metadata }

  if (dataRequest) return Server.Responded(Response.json(readyFlags, { status, headers }))

  const rendered = await Effect.runPromise(
    Server.renderToString(applicationConfig, {
      flags: readyFlags,
      url: url.href,
      buildId: import.meta.env.FOLDKIT_BUILD_ID,
    }),
  )

  const head = renderDocumentHead(metadata)

  const extraHead =
    `<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}"><meta property="og:url" content="${escapeHtml(metadata.canonicalUrl)}">` +
    head.meta
      .flatMap((entry) =>
        'title' in entry || ('property' in entry && entry.property === 'og:url')
          ? []
          : [
              `<meta data-gbfm-metadata ${'name' in entry ? `name="${escapeHtml(entry.name)}"` : `property="${escapeHtml(entry.property)}"`} content="${escapeHtml(entry.content)}">`,
            ],
      )
      .join('') +
    head.scripts
      .map(
        (script) =>
          `<script data-gbfm-metadata type="application/ld+json">${script.children.replaceAll('<', '\\u003c')}</script>`,
      )
      .join('')

  const privatePage =
    Route.guards.Dashboard(route) ||
    Route.guards.Composer(route) ||
    Route.guards.Auth(route) ||
    url.pathname === '/spotify/callback'

  const html = Server.injectIntoTemplate(template, rendered).replace(
    '</head>',
    `${extraHead}${privatePage || status !== 200 ? '<meta data-gbfm-metadata name="robots" content="noindex, nofollow">' : ''}</head>`,
  )

  headers.set('content-type', 'text/html; charset=utf-8')

  return Server.Responded(
    new Response(request.method === 'HEAD' ? null : html, { status, headers }),
  )
}

/** One request-owned correlation ID covers SSR, actions, redirects, and API forwarding. Logs exclude raw URLs and payloads. */
export const renderPage = async (request: Request): Promise<Server.EntryResult> => {
  const startedAt = performance.now()
  const requestId = resolveRequestId(request.headers.get('x-request-id'))
  const owned = new Request(request)
  owned.headers.set('x-request-id', requestId)

  const attributes = {
    service: 'www',
    requestId,
    route: routeTemplate(undefined, new URL(request.url).pathname),
    method: request.method,
    release: import.meta.env.PROD ? import.meta.env.FOLDKIT_BUILD_ID : 'local',
  }

  try {
    const result = import.meta.env.DEV
      ? Server.Responded(
          await (
            await import('./telemetry/local-request-tracing')
          ).traceLocalRequest(owned, async (traced) => (await renderResponse(traced)).response),
        )
      : await renderResponse(owned)

    const response = new Response(result.response.body, result.response)
    response.headers.set('x-request-id', requestId)
    await Effect.runPromise(
      Effect.logInfo({
        ...attributes,
        operation: 'request.completed',
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    )

    if (import.meta.env.DEV && new URL(request.url).pathname !== '/telemetry/browser')
      submitLocalRequestLog({
        service: 'www',
        method: request.method,
        route: attributes.route,
        requestId,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      })

    return Server.Responded(response)
  } catch (cause) {
    if (request.signal.aborted) throw cause
    await Effect.runPromise(
      Effect.logError({
        ...attributes,
        operation: 'request.failed',
        status: 500,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    )

    if (import.meta.env.DEV && new URL(request.url).pathname !== '/telemetry/browser')
      submitLocalRequestLog({
        service: 'www',
        method: request.method,
        route: attributes.route,
        requestId,
        status: 500,
        durationMs: Math.round(performance.now() - startedAt),
      })

    return Server.Responded(
      new Response(`Something went wrong. Request ID: ${requestId}`, {
        status: 500,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'private, no-store',
          'x-request-id': requestId,
        },
      }),
    )
  }
}
