import { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import { MicroPostScreenResponse } from '@gbfm/api/post'
import { resolveRequestId } from '@gbfm/core/observability/request-id'
import { makeStaticSiteMetadata, renderDocumentHead, SiteMetadata } from '@gbfm/site-metadata'
import { Effect, Option, Schema } from 'effect'
import * as Server from 'foldkit/experimental/server'
import template from 'virtual:gbfm-document'

import {
  applicationConfig,
  type ContentItem,
  type Flags,
  parseRoute,
  Principal,
  Route,
} from './application'
import { parseDashboardDocument } from './dashboard/document'
import { endpointFor as dashboardEndpointFor, isAdminSection } from './dashboard/model'
import { staticPages } from './static-pages'
import { handleBrowserTelemetry } from './telemetry/server'

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

  if (cookie) headers.set('cookie', cookie)
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
])

export const endpointFor = (route: Route): string | null =>
  Route.match(route, {
    Home: () => '/api/content/audio/mix?limit=12&offset=0',
    Listing: ({ kind }) => endpoints.get(kind) ?? null,
    Detail: ({ kind, slug }) => {
      if (kind === 'tags') return `/api/content/posts/micro?tag=${encodeURIComponent(slug)}`
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
        href: `${path}/${encodeURIComponent(slug)}`,
        meta: text(item.createdAt) || null,
      },
    ]
  })
}

const json = async (response: Response): Promise<Schema.Json> =>
  Schema.decodeUnknownSync(Schema.Json)(await response.json())

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

const formAction = async (request: Request): Promise<Server.EntryResult> => {
  const url = new URL(request.url)

  if (request.headers.get('origin') !== url.origin)
    return Server.Responded(new Response('Forbidden', { status: 403 }))
  const form = await request.formData()

  const field = (name: string) =>
    Option.getOrElse(Schema.decodeUnknownOption(Schema.String)(form.get(name)), () => '')

  const action = url.pathname

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

  return redirect(
    authPath ? '/dashboard' : `/tweet/${encodeURIComponent(url.searchParams.get('slug') ?? '')}`,
    response.headers.getSetCookie(),
  )
}

export const renderPage = async (request: Request): Promise<Server.EntryResult> => {
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
    (url.pathname.startsWith('/auth/') && !Route.guards.Auth(route)) ||
    ['/rss.xml', '/sitemap.xml'].includes(url.pathname)
  )
    return Server.Responded(await apiRequest(ownedRequest, `${url.pathname}${url.search}`))

  if (!['GET', 'HEAD'].includes(request.method))
    return Server.Responded(new Response(null, { status: 405 }))

  if (['/tweet/latest', '/tweet'].includes(url.pathname)) return redirect('/tweets')

  if (url.pathname === '/tweets' && !url.searchParams.has('q')) {
    const latest = await apiRequest(ownedRequest, '/api/content/posts/micro/latest', {
      method: 'GET',
    })

    const slug = text(record(await json(latest))?.slug)

    if (slug) return redirect(`/tweet/${encodeURIComponent(slug)}`)
  }

  const identity = await session(ownedRequest)

  const dashboardPath =
    Route.guards.Dashboard(route) &&
    identity.principal &&
    (!isAdminSection(route.section) || identity.principal.role === 'admin')
      ? dashboardEndpointFor(route.section)
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

  const items = contentItems(payload, listPath)

  const title =
    tweet?.post.title ??
    tweet?.post.content?.slice(0, 80) ??
    (Route.guards.Detail(route) ? items[0]?.title : null) ??
    Route.match(route, {
      Home: () => 'goosebumps.fm',
      Listing: ({ kind }) => kind.charAt(0).toUpperCase() + kind.slice(1),
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
    url: url.href,
    status,
    principal: identity.principal,
    items,
    title,
    description:
      tweet?.post.description ??
      items[0]?.description ??
      'Independent music, mixes and stories on goosebumps.fm.',
    requestId,
    tweet,
    neighbours,
    dashboard,
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

  if (dataRequest) return Server.Responded(Response.json(flags, { status, headers }))

  const rendered = await Effect.runPromise(
    Server.renderToString(applicationConfig, {
      flags,
      url: url.href,
      buildId: import.meta.env.FOLDKIT_BUILD_ID,
    }),
  )

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

  const kind = Route.guards.Detail(route) ? metadataKind.get(route.kind) : undefined

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

  const metadata = publicMetadata ?? makeStaticSiteMetadata(title, flags.description, url.pathname)
  const head = renderDocumentHead(metadata)

  const extraHead =
    `<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}">` +
    head.meta
      .flatMap((entry) =>
        'title' in entry
          ? []
          : [
              `<meta ${'name' in entry ? `name="${escapeHtml(entry.name)}"` : `property="${escapeHtml(entry.property)}"`} content="${escapeHtml(entry.content)}">`,
            ],
      )
      .join('') +
    head.scripts
      .map(
        (script) =>
          `<script type="application/ld+json">${script.children.replaceAll('<', '\\u003c')}</script>`,
      )
      .join('')

  const privatePage =
    Route.guards.Dashboard(route) || Route.guards.Composer(route) || Route.guards.Auth(route)

  const html = Server.injectIntoTemplate(template, rendered).replace(
    '</head>',
    `${extraHead}${privatePage || status !== 200 ? '<meta name="robots" content="noindex, nofollow">' : ''}</head>`,
  )

  headers.set('content-type', 'text/html; charset=utf-8')

  return Server.Responded(
    new Response(request.method === 'HEAD' ? null : html, { status, headers }),
  )
}
