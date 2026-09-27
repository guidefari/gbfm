import { GetFavoritesResponse } from '@gbfm/api/favorites'
import { MicroPostNeighboursResponse, MicroPostRandomUnreadResponse } from '@gbfm/api/navigation'
import { GetPostTagsResponse, GetPostsByTagResponse, MicroPostScreenResponse } from '@gbfm/api/post'
import { PublicProfileResponse } from '@gbfm/api/profile'
import { ResolveResult } from '@gbfm/api/resolve'
import { GetAllShowsResponse, GetShowEpisodesResponse } from '@gbfm/api/shows'
import { GetUserSubscriptionsResponse, ListDjsResponse } from '@gbfm/api/user'
import { submitLocalRequestLog } from '@gbfm/core/observability/local-loki'
import { resolveRequestId } from '@gbfm/core/observability/request-id'
import { isRole } from '@gbfm/core/roles'
import {
  makeStaticSiteMetadata,
  renderDocumentHead,
  SiteMetadata,
  SITE_URL,
} from '@gbfm/site-metadata'
import { Effect, Match, Option, Schema } from 'effect'
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
import type { ShowsDocument } from './shows'
import { staticPages } from './static-pages'
import { routeTemplate } from './telemetry/privacy'
import { handleBrowserTelemetry } from './telemetry/server'
import { readModeCookie, skipsSeenTweets } from './tweet-navigation'

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

/** The original Request preserves streaming bodies, aborts and all response cookies. */
export const apiRequest = async (
  request: Request,
  path: string,
  init?: RequestInit,
): Promise<Response> => {
  const headers = new Headers(init?.headers ?? request.headers)
  const cookie = request.headers.get('cookie')
  const traceparent = request.headers.get('traceparent')

  if (cookie) headers.set('cookie', cookie)

  if (traceparent) headers.set('traceparent', traceparent)
  headers.delete('host')
  headers.delete('content-length')
  headers.set('x-request-id', resolveRequestId(request.headers.get('x-request-id')))
  const target = new URL(path, 'https://api.internal')

  const forwarded = init
    ? new Request(target, { ...init, headers, signal: request.signal })
    : new Request(target, request)

  headers.forEach((value, name) => forwarded.headers.set(name, value))

  if (import.meta.env.PROD) {
    const { env } = await import('cloudflare:workers')

    return env.API.fetch(forwarded)
  }

  return fetch(
    new Request(new URL(path, process.env.VPS_PROXY_TARGET ?? 'http://127.0.0.1:3003'), forwarded),
  )
}

const endpoints = new Map([
  ['mixes', '/api/content/audio/mix'],
  ['tracks', '/api/content/audio/track'],
  ['shows', '/api/shows'],
  ['editorial', '/api/content/posts/editorials'],
  ['tweets', '/api/content/posts/micro'],
  ['labels', '/api/music/labels'],
  ['releases', '/api/content/releases'],
  ['tags', '/api/content/posts/tags'],
  ['djs', '/api/user/djs'],
  ['profile', '/api/profile'],
  ['resolve', '/api/resolve'],
])

export const endpointFor = (route: Route): string | null =>
  Route.match(route, {
    Home: () => '/api/content/audio/mix?limit=12&offset=0',
    Listing: ({ kind }) =>
      kind === 'shows' ? '/api/shows?limit=100&offset=0' : (endpoints.get(kind) ?? null),
    Detail: ({ kind, slug }) => {
      if (kind === 'tags') return `/api/content/tag/${encodeURIComponent(slug)}`
      const root = endpoints.get(kind)

      return root
        ? `${root}${kind === 'labels' ? '/slug' : ''}/${encodeURIComponent(slug)}${kind === 'tweets' ? '/screen?part=main' : ''}`
        : null
    },
    Auth: () => null,
    Composer: () => null,
    Dashboard: () => null,
    Static: () => null,
    NotFound: () => null,
  })

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
    const title = text(item.title, text(item.name, text(item.username, content.slice(0, 80))))

    if (!slug) return []

    return [
      {
        id: text(item.id, slug),
        slug,
        title,
        content,
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
  let offset = 0

  while (true) {
    const response = await apiRequest(
      request,
      `${target.kind === 'audio' ? '/api/favorites' : '/api/user/subscriptions'}?limit=100&offset=${offset}`,
      { method: 'GET' },
    )

    if (!response.ok) return 'unavailable'

    if (target.kind === 'audio') {
      const result = Schema.decodeUnknownSync(GetFavoritesResponse)(await response.json())

      if (result.favorites.some((favorite) => favorite.audioId === target.id)) return 'active'
      offset += result.favorites.length

      if (!result.favorites.length || offset >= result.total) return 'inactive'
    } else {
      const result = Schema.decodeUnknownSync(GetUserSubscriptionsResponse)(await response.json())

      if (result.data.some((subscription) => subscription.showId === target.id)) return 'active'
      offset += result.data.length

      if (!result.data.length || !result.pagination.hasMore) return 'inactive'
    }
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

const redirect = (location: string, cookies: ReadonlyArray<string> = []) => {
  const headers = new Headers({ location, 'cache-control': 'private, no-store' })

  for (const cookie of cookies) headers.append('set-cookie', cookie)

  return Server.Responded(new Response(null, { status: 303, headers }))
}

const formAction = async (request: Request): Promise<Server.Responded> => {
  const url = new URL(request.url)

  if (request.headers.get('origin') !== url.origin)
    return Server.Responded(new Response('Forbidden', { status: 403 }))
  const form = await request.formData()

  const field = (name: string) =>
    Option.getOrElse(Schema.decodeUnknownOption(Schema.String)(form.get(name)), () => '')

  const action = url.pathname

  if (action.startsWith('/actions/admin/')) {
    const operation = action.slice('/actions/admin/'.length)
    const userId = field('userId')
    const role = field('role')

    if ((operation === 'create-user' || operation === 'set-role') && !isRole(role))
      return redirect('/dashboard/users?notice=failed')

    if (operation === 'create-user' && !field('email').trim() && !field('username').trim())
      return redirect('/dashboard/users?notice=failed')

    const payload = Match.value(operation).pipe(
      Match.when('create-user', () => {
        const username = field('username').trim()

        const body = {
          name: field('name').trim() || username || 'User',
          email: field('email').trim() || `${username}@placeholder.local`,
          password: field('password') || crypto.randomUUID(),
          role,
        }

        return username ? { ...body, data: { username } } : body
      }),
      Match.when('set-role', () => ({ userId, role })),
      Match.when('ban-user', () =>
        field('banReason') ? { userId, banReason: field('banReason') } : { userId },
      ),
      Match.whenOr('unban-user', 'remove-user', 'invite', () => ({ userId })),
      Match.orElse(() => null),
    )

    if (!payload) return Server.Responded(new Response('Not found', { status: 404 }))

    const response = await apiRequest(
      request,
      operation === 'invite' ? '/api/invite/send' : `/auth/admin/${operation}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: url.origin },
        body: JSON.stringify(payload),
      },
    )

    const returnQuery = new URLSearchParams({
      notice: response.ok ? 'done' : 'failed',
      search: url.searchParams.get('search') ?? '',
      offset: url.searchParams.get('offset') ?? '0',
    })

    return redirect(`/dashboard/users?${returnQuery}`, response.headers.getSetCookie())
  }

  if (action === '/actions/tweet-read-mode') {
    const mode = field('mode') === 'all' ? 'all' : 'unread'

    return Server.Responded(
      new Response(null, {
        status: 204,
        headers: {
          'cache-control': 'private, no-store',
          'set-cookie': `${readModeCookie}=${mode}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`,
        },
      }),
    )
  }

  if (action === '/actions/tweet-random') {
    const response = await apiRequest(
      request,
      `/api/content/posts/micro/${encodeURIComponent(field('slug'))}/random`,
      { method: 'GET' },
    )

    if (!response.ok)
      return redirect(`/tweet/${encodeURIComponent(field('slug'))}?random=unavailable`)
    const result = Schema.decodeUnknownSync(MicroPostRandomUnreadResponse)(await response.json())

    return redirect(`/tweet/${encodeURIComponent(result.slug)}`)
  }

  if (action === '/actions/sign-out') {
    const response = await apiRequest(request, '/auth/sign-out', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: url.origin },
      body: '{}',
    })

    if (!response.ok)
      return Server.Responded(
        new Response('Sign out failed. Please try again.', { status: response.status }),
      )

    return redirect('/', response.headers.getSetCookie())
  }

  const newsletterPath = Match.value(action).pipe(
    Match.when('/actions/subscribe', () => '/api/newsletter/subscribe'),
    Match.when('/actions/unsubscribe', () =>
      field('token') ? '/api/newsletter/unsubscribe' : '/api/newsletter/request-unsubscribe',
    ),
    Match.orElse(() => null),
  )

  if (newsletterPath) {
    const response = await apiRequest(request, newsletterPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: url.origin },
      body: JSON.stringify(
        field('token') ? { token: field('token') } : { email: field('email'), name: field('name') },
      ),
    })

    if (!response.ok)
      return Server.Responded(
        new Response('The request could not be completed. Please try again.', {
          status: response.status,
          headers: { 'cache-control': 'no-store' },
        }),
      )

    return redirect(
      action === '/actions/subscribe'
        ? '/subscribe?complete=1'
        : `/unsubscribe?complete=${field('token') ? 'removed' : 'requested'}`,
    )
  }

  const authPath = new Map([
    ['/auth/sign-in', '/auth/sign-in/email'],
    ['/auth/sign-up', '/auth/sign-up/email'],
    ['/auth/forgot-password', '/auth/request-password-reset'],
    ['/auth/reset-password', '/auth/reset-password'],
  ]).get(action)

  const path =
    authPath ??
    (action === '/actions/reply'
      ? `/api/content/posts/micro/${encodeURIComponent(url.searchParams.get('slug') ?? '')}/replies`
      : null)

  if (!path) return Server.Responded(new Response('Not found', { status: 404 }))

  const response = await apiRequest(request, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url.origin },
    body: JSON.stringify(
      authPath
        ? {
            email: field('email'),
            password: field('password'),
            name: field('name'),
            token: field('token'),
            newPassword: field('password'),
            redirectTo: `${url.origin}/auth/reset-password`,
          }
        : { content: field('content') },
    ),
  })

  if (!response.ok)
    return Server.Responded(
      new Response('The request could not be completed. Check your details and try again.', {
        status: response.status,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      }),
    )

  const returnUrl = URL.parse(field('returnTo') || '/dashboard', url.origin)

  const returnPath =
    returnUrl?.origin === url.origin ? `${returnUrl.pathname}${returnUrl.search}` : '/dashboard'

  return redirect(
    Match.value(action).pipe(
      Match.when('/auth/forgot-password', () => '/auth/forgot-password?sent=1'),
      Match.when('/auth/reset-password', () => '/auth/sign-in?reset=1'),
      Match.orElse(() =>
        authPath ? returnPath : `/tweet/${encodeURIComponent(url.searchParams.get('slug') ?? '')}`,
      ),
    ),
    response.headers.getSetCookie(),
  )
}

const renderResponse = async (request: Request): Promise<Server.Responded> => {
  const startedAt = performance.now()
  const url = new URL(request.url)
  const host = request.headers.get('host')

  // Foldkit's Vite adapter uses localhost as its URL base; preserve the incoming dev origin.
  if (import.meta.env.DEV && host) url.host = host
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
    return formAction(ownedRequest)

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

  const endpoint = endpointFor(route)

  const response = endpoint
    ? await apiRequest(ownedRequest, endpoint, { method: 'GET' }).catch(() => null)
    : null

  const payload = response?.ok ? await json(response) : null

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

  const isTweet = Route.guards.Detail(route) && route.kind === 'tweets'

  const tweet =
    isTweet && payload ? Schema.decodeUnknownSync(MicroPostScreenResponse)(payload) : null

  const neighbourResponse =
    isTweet && Route.guards.Detail(route)
      ? await apiRequest(
          ownedRequest,
          `/api/content/posts/micro/${encodeURIComponent(route.slug)}/neighbours`,
          { method: 'GET' },
        ).catch(() => null)
      : null

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
    const allResponse = Route.guards.Listing(route)
      ? response
      : await apiRequest(ownedRequest, '/api/shows?limit=100&offset=0', { method: 'GET' }).catch(
          () => null,
        )

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
        ? await apiRequest(
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
    kind && Route.guards.Detail(route) && status === 200
      ? await apiRequest(
          ownedRequest,
          `/api/site-metadata/${kind}/${encodeURIComponent(route.slug)}`,
          { method: 'GET' },
        )
          .then(async (response) =>
            response.ok
              ? Option.getOrNull(Schema.decodeUnknownOption(SiteMetadata)(await response.json()))
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
