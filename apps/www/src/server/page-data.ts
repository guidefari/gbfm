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
import { RichContentDocument } from '@gbfm/rich-content/schema'
import { SiteMetadata } from '@gbfm/site-metadata'
import { Effect, Option, Schema } from 'effect'
import changelog from 'virtual:repo-changelog'

import { ContentItem, type Flags, Principal, Route } from '../application'
import { parseDashboardDocument } from '../dashboard/document'
import { endpointFor as dashboardEndpointFor, isAdminSection } from '../dashboard/model'
import type { Document as PublicActionDocument } from '../public-actions'
import type { ShowsDocument } from '../shows'
import { staticPages } from '../static-pages'
import { skipsSeenTweets } from '../tweet/navigation'
import { apiRequest, endpointFor } from './api'

const JsonObject = Schema.Record(Schema.String, Schema.Json)

const record = (value: Schema.Json | undefined) =>
  Option.getOrNull(Schema.decodeUnknownOption(JsonObject)(value))

const text = (value: Schema.Json | undefined, fallback = '') =>
  Option.getOrElse(Schema.decodeUnknownOption(Schema.String)(value), () => fallback)

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

export const loadPageData = async (
  ownedRequest: Request,
  request: Request,
  url: URL,
  route: Route,
  requestId: string,
) => {
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
    return { redirect: `/shows/${encodeURIComponent(resolved.data.slug)}` } as const

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

  return {
    redirect: null,
    flags,
    identity,
    response,
    neighbourResponse,
    tweetData,
    showDetailSlug,
    showMetadata,
    profile,
    route,
    url,
    requestId,
  } as const
}
