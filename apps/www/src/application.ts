import { AudioResponse } from '@gbfm/api/audio'
import { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import { MicroPostScreenResponse, MicroPostScreenRepliesResponse } from '@gbfm/api/post'
import { PublicProfileResponse } from '@gbfm/api/profile'
import { ReleaseResponse } from '@gbfm/api/release'
import { canCreatePosts, isRole } from '@gbfm/core/roles'
import { SiteMetadata } from '@gbfm/site-metadata'
import { Effect, HashMap, Layer, Match, Option, Result, Schema } from 'effect'
import { AsyncData, Command, Navigation, Subscription, type Runtime, type Update } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest } from 'foldkit/navigation'
import { Url, toString as urlToString } from 'foldkit/url'

import { artwork, preloadArtwork } from './artwork'
import * as Creator from './creator'
import * as Dashboard from './dashboard'
import { DashboardDocument } from './dashboard/document'
import { updateDocumentHead } from './document-head'
import { editorialList } from './editorial-list'
import { formatDate } from './format-date'
import { iconPaths, lucide } from './icons'
import { invitationView } from './invitation'
import { newsletterView } from './newsletter'
import { isCacheable, pageKey, samePage } from './page-cache'
import * as Player from './player'
import * as PublicActions from './public-actions'
import { profileView } from './public-profile'
import { richContent } from './rich-content'
import * as Search from './search'
import { type Episode, ShowsDocument, showImages, showsView } from './shows'
import { pageSkeleton } from './skeletons'
import { type SpotifyConnection, SpotifyConnectionLive } from './spotify'
import { staticPages } from './static-pages'
import { stationNav } from './station-nav'
import {
  authorRow,
  cardActions,
  musicCard,
  parentPreview,
  quoteCard,
  replyCard,
  replySkeleton,
  tagLinks,
  tweetBody,
  tweetImages,
  type TweetPost,
} from './tweet-card'
import { tweetWayfinder } from './tweet-wayfinder'

export const Principal = Schema.Struct({
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  username: Schema.NullOr(Schema.String),
  role: Schema.NullOr(Schema.String),
})

export type Principal = typeof Principal.Type

export const ContentItem = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  imageUrl: Schema.NullOr(Schema.String),
  href: Schema.String,
  meta: Schema.NullOr(Schema.String),
  content: Schema.String,
  audioUrl: Schema.NullOr(Schema.String),
  audioType: Schema.NullOr(AudioResponse.fields.type),
  creators: AudioResponse.fields.creators,
  tags: ReleaseResponse.fields.tags,
  streamingLinks: ReleaseResponse.fields.streamingLinks,
})

export type ContentItem = typeof ContentItem.Type

export const Flags = Schema.Struct({
  url: Schema.String,
  status: Schema.Number,
  principal: Schema.NullOr(Principal),
  items: Schema.Array(ContentItem),
  title: Schema.String,
  description: Schema.String,
  requestId: Schema.String,
  renderedAt: Schema.Number,
  skipSeen: Schema.Boolean,
  tweet: Schema.NullOr(MicroPostScreenResponse),
  neighbours: Schema.NullOr(MicroPostNeighboursResponse),
  dashboard: Schema.NullOr(DashboardDocument),
  profile: Schema.NullOr(PublicProfileResponse),
  shows: Schema.NullOr(ShowsDocument),
  changelog: Schema.NullOr(Schema.String),
  publicAction: Schema.NullOr(PublicActions.Document),
  metadata: Schema.NullOr(SiteMetadata),
  failure: Schema.NullOr(Schema.String),
})

export type Flags = typeof Flags.Type

export const Route = Schema.TaggedUnion({
  Home: {},
  Listing: { kind: Schema.String },
  Detail: { kind: Schema.String, slug: Schema.String },
  Auth: { action: Schema.String },
  Composer: { kind: Schema.String },
  Dashboard: { section: Schema.String },
  Static: { page: Schema.String },
  NotFound: {},
})

export type Route = typeof Route.Type

const listingKinds = new Set([
  'mixes',
  'tracks',
  'shows',
  'editorial',
  'tweets',
  'labels',
  'releases',
  'tags',
  'djs',
])

/** Same-origin paths answered by the API rather than a Foldkit page, so they need a full load. */
const serverPaths = ['/rss.xml', '/sitemap.xml', '/robots.txt', '/api/', '/health', '/s/']

const isServerPath = (pathname: string) =>
  serverPaths.some((path) => (path.endsWith('/') ? pathname.startsWith(path) : pathname === path))

export const parseRoute = (pathname: string): Route => {
  let parts: Array<string>

  try {
    parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return Route.cases.NotFound.make({})
  }

  const [first = '', second] = parts

  if (!first) return Route.cases.Home.make({})

  if (first === 'dashboard')
    return Route.cases.Dashboard.make({ section: parts.slice(1).join('/') || 'favorites' })

  if (first === 'reminders') return Route.cases.Dashboard.make({ section: 'reminders' })

  if (first === 'spotify' && second === 'callback' && parts.length === 2)
    return Route.cases.Static.make({ page: 'spotify-callback' })

  if (parts.length > 2) return Route.cases.NotFound.make({})

  if (first === 'invite' && second === 'charlie3000')
    return Route.cases.Static.make({ page: 'invite/charlie3000' })

  if (
    first === 'auth' &&
    second &&
    ['sign-in', 'sign-up', 'forgot-password', 'reset-password', 'verify-email'].includes(second)
  )
    return Route.cases.Auth.make({ action: second })

  if (first === 'new') return Route.cases.Composer.make({ kind: second ?? 'chooser' })

  if (first === 'mix-upload') return Route.cases.Composer.make({ kind: 'mix' })

  if (['privacy', 'terms', 'changelog', 'subscribe', 'unsubscribe'].includes(first) && !second)
    return Route.cases.Static.make({ page: first })

  if (listingKinds.has(first))
    return second
      ? Route.cases.Detail.make({ kind: first, slug: second })
      : Route.cases.Listing.make({ kind: first })

  if (first === 'profile' && second) return Route.cases.Detail.make({ kind: first, slug: second })

  if (first === 'tweet' && second) return Route.cases.Detail.make({ kind: 'tweets', slug: second })

  if (parts.length === 1) return Route.cases.Detail.make({ kind: 'resolve', slug: first })

  return Route.cases.NotFound.make({})
}

/** Stale-while-revalidate page data per URL, so revisits render immediately while a fresh copy loads. */
const PageData = AsyncData.Schema(Flags, Schema.String)

type PageCache = HashMap.HashMap<string, AsyncData.AsyncData<Flags, string>>

const settlePage = (
  cache: PageCache,
  key: string,
  result: Result.Result<Flags, string>,
): PageCache => {
  if (!isCacheable(key)) return cache
  const entry = AsyncData.fromOptionOrIdle(HashMap.get(cache, key))

  return HashMap.set(cache, key, AsyncData.settle(entry, result))
}

const seedCache = (flags: Flags): PageCache =>
  settlePage(HashMap.empty(), pageKey(flags.url), Result.succeed(flags))

export const Model = Schema.Struct({
  route: Route,
  flags: Flags,
  menuOpen: Schema.Boolean,
  search: Search.Model,
  skipSeen: Schema.Boolean,
  loading: Schema.Boolean,
  pendingPath: Schema.NullOr(Schema.String),
  pageCache: Schema.HashMap(Schema.String, PageData.schema),
  interactive: Schema.Boolean,
  navigationId: Schema.Number,
  error: Schema.NullOr(Schema.String),
  repliesStatus: Schema.Literals(['loading', 'ready', 'error']),
  player: Player.Model,
  publicAction: PublicActions.Model,
  creator: Creator.Model,
  dashboard: Dashboard.Model,
})

export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ClientStarted: {},
  MenuToggled: {},
  GotSearchMessage: { message: Search.Message },
  GotPublicActionMessage: { message: PublicActions.Message },
  SkipSeenChanged: { value: Schema.Boolean },
  ReadModeFailed: {},
  GotPlayerMessage: { message: Player.Message },
  GotCreatorMessage: { message: Creator.Message },
  GotCreatorResult: { message: Creator.Message, navigationId: Schema.Number },
  GotDashboardMessage: { message: Dashboard.Message },
  GotDashboardResult: { message: Dashboard.Message, navigationId: Schema.Number },
  RequestedUrl: { request: UrlRequest },
  ChangedUrl: { url: Url },
  LoadedPage: { flags: Flags, key: Schema.String, navigationId: Schema.Number },
  FailedPage: { key: Schema.String, navigationId: Schema.Number },
  LoadedReplies: { slug: Schema.String, replies: MicroPostScreenRepliesResponse },
  FailedReplies: { slug: Schema.String },
  NavigationCompleted: {},
  PrefetchedPage: { flags: Flags, key: Schema.String },
  PrefetchRequested: { href: Schema.String },
})

export type Message = typeof Message.Type

type Services =
  | Player.PlayerClient
  | Creator.CreatorService
  | Creator.CreatorUpload
  | Dashboard.DashboardService
  | Dashboard.SessionService
  | SpotifyConnection

const StartClient = Command.define('Application.Start', {
  messages: [Message.ClientStarted],
  execute: Effect.succeed(Message.ClientStarted()),
})

const PauseCreatorUpload = Command.define('Application.PauseCreatorUpload', {
  messages: [Message.NavigationCompleted],
  execute: Effect.flatMap(Creator.CreatorUpload, (upload) => upload.pause).pipe(
    Effect.as(Message.NavigationCompleted()),
  ),
})

const LoadReplies = Command.define('Tweet.LoadReplies', {
  args: { slug: Schema.String },
  messages: [Message.LoadedReplies, Message.FailedReplies],
  execute: ({ slug }) =>
    Effect.tryPromise(async (signal) => {
      const response = await fetch(
        `/api/content/posts/micro/${encodeURIComponent(slug)}/screen/replies`,
        { signal },
      )

      if (!response.ok) throw new Error('Replies unavailable')

      return response.json()
    }).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(MicroPostScreenRepliesResponse)),
      Effect.map((replies) => Message.LoadedReplies({ slug, replies })),
      Effect.catch(() => Effect.succeed(Message.FailedReplies({ slug }))),
    ),
})

const MarkSeen = Command.define('Tweet.MarkSeen', {
  args: { slug: Schema.String },
  messages: [Message.NavigationCompleted],
  execute: ({ slug }) =>
    Effect.tryPromise((signal) =>
      fetch(`/api/content/posts/micro/${encodeURIComponent(slug)}/seen`, {
        method: 'POST',
        credentials: 'same-origin',
        signal,
      }),
    ).pipe(
      Effect.as(Message.NavigationCompleted()),
      Effect.orElseSucceed(() => Message.NavigationCompleted()),
    ),
})

const Navigate = Command.define('Navigation.Push', {
  args: { href: Schema.String },
  messages: [Message.NavigationCompleted],
  execute: ({ href }) => Navigation.pushUrl(href).pipe(Effect.as(Message.NavigationCompleted())),
})

const SaveReadMode = Command.define('Tweet.SaveReadMode', {
  args: { value: Schema.Boolean },
  messages: [Message.NavigationCompleted, Message.ReadModeFailed],
  execute: ({ value }) =>
    Effect.tryPromise(async (signal) => {
      const response = await fetch('/actions/tweet-read-mode', {
        method: 'POST',
        signal,
        credentials: 'same-origin',
        body: new URLSearchParams({ mode: value ? 'unread' : 'all' }),
      })

      if (!response.ok) throw new Error('Read mode save failed')
    }).pipe(
      Effect.as(Message.NavigationCompleted()),
      Effect.orElseSucceed(() => Message.ReadModeFailed()),
    ),
})

const Leave = Command.define('Navigation.Leave', {
  args: { href: Schema.String },
  messages: [Message.NavigationCompleted],
  execute: ({ href }) => Navigation.load(href).pipe(Effect.as(Message.NavigationCompleted())),
})

const SetResolvedUrl = Command.define('Navigation.SetResolvedUrl', {
  args: { href: Schema.String, metadata: Schema.NullOr(SiteMetadata), noindex: Schema.Boolean },
  messages: [Message.NavigationCompleted],
  execute: ({ href, metadata, noindex }) =>
    Effect.sync(() => {
      const target = new URL(href)

      if (metadata) updateDocumentHead(metadata, noindex)

      // Preserve Foldkit's history state without issuing a second loader request.
      if (`${location.pathname}${location.search}` !== `${target.pathname}${target.search}`)
        history.replaceState(history.state, '', `${target.pathname}${target.search}`)

      return Message.NavigationCompleted()
    }),
})

const fetchPage = (href: string) =>
  Effect.tryPromise(async (signal) => {
    const url = new URL(href, location.href)
    url.searchParams.set('__data', '1')

    const response = await fetch(url, {
      headers: { accept: 'text/html' },
      credentials: 'same-origin',
      signal,
    })

    return await response.json()
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Flags)))

/** Warms the page cache and the images a neighbouring page paints first, without navigation telemetry. */
const PrefetchPage = Command.define('Navigation.Prefetch', {
  args: { href: Schema.String },
  messages: [Message.PrefetchedPage, Message.NavigationCompleted],
  execute: ({ href }) =>
    fetchPage(href).pipe(
      Effect.tap((flags) =>
        Effect.promise(() =>
          Promise.all(
            [
              ...(flags.tweet ? tweetImages(flags.tweet) : []),
              ...(flags.shows ? showImages(flags.shows) : []),
            ].map(({ src, sizes }) => preloadArtwork(src, sizes)),
          ),
        ),
      ),
      Effect.map((flags) => Message.PrefetchedPage({ flags, key: pageKey(href) })),
      Effect.catch(() => Effect.succeed(Message.NavigationCompleted())),
    ),
})

const LoadPage = Command.define('Navigation.Load', {
  args: { href: Schema.String, navigationId: Schema.Number },
  messages: [Message.LoadedPage, Message.FailedPage],
  execute: ({ href, navigationId }) =>
    Effect.sync(() => window.dispatchEvent(new Event('gbfm:navigation-start'))).pipe(
      Effect.andThen(fetchPage(href)),
      Effect.tap(() =>
        Effect.sync(() => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => window.dispatchEvent(new Event('gbfm:navigation-end'))),
          )
        }),
      ),
      Effect.map((flags) => Message.LoadedPage({ flags, key: pageKey(href), navigationId })),
      Effect.catch(() => Effect.succeed(Message.FailedPage({ key: pageKey(href), navigationId }))),
    ),
})

const showPage = (
  model: Model,
  flags: Flags,
  navigationId: number,
): Update.Return<Model, Message, Services> => {
  const next = init(flags)

  return {
    ...next,
    model: {
      ...next.model,
      player: model.player,
      skipSeen: model.skipSeen,
      menuOpen: model.menuOpen,
      search: model.search,
      pageCache: model.pageCache,
      navigationId,
    },
    commands: [
      ...Command.mapMessages(next.commands ?? [], (message) =>
        Match.value(message).pipe(
          Match.tag('GotCreatorResult', ({ message }) =>
            Message.GotCreatorResult({ message, navigationId }),
          ),
          Match.tag('GotDashboardResult', ({ message }) =>
            Message.GotDashboardResult({ message, navigationId }),
          ),
          Match.orElse((message) => message),
        ),
      ),
      SetResolvedUrl({
        href: flags.url,
        metadata: flags.metadata,
        noindex:
          flags.status !== 200 ||
          Route.guards.Dashboard(next.model.route) ||
          Route.guards.Composer(next.model.route) ||
          Route.guards.Auth(next.model.route) ||
          (Route.guards.Static(next.model.route) && next.model.route.page === 'spotify-callback'),
      }),
    ],
  }
}

export const update = (model: Model, message: Message): Update.Return<Model, Message, Services> =>
  Message.match<Update.Return<Model, Message, Services>>(message, {
    ClientStarted: () => ({ model: { ...model, interactive: true } }),
    MenuToggled: () => ({ model: { ...model, menuOpen: !model.menuOpen } }),
    GotSearchMessage: ({ message }) => {
      const child = Search.update(model.search, message)

      return {
        model: { ...model, search: child.model, menuOpen: false },
        commands: Command.mapMessages(child.commands ?? [], (message) =>
          Message.GotSearchMessage({ message }),
        ),
      }
    },
    SkipSeenChanged: ({ value }) => ({
      model: { ...model, skipSeen: value },
      commands: [SaveReadMode({ value })],
    }),
    GotPublicActionMessage: ({ message }) => {
      const child = PublicActions.update(model.publicAction, message)

      return {
        model: { ...model, publicAction: child.model },
        commands: Command.mapMessages(child.commands ?? [], (message) =>
          Message.GotPublicActionMessage({ message }),
        ),
      }
    },
    ReadModeFailed: () => ({
      model: { ...model, error: 'Could not save your tweet reading preference. Try again.' },
    }),
    LoadedReplies: ({ slug, replies }) =>
      model.flags.tweet?.post.slug === slug
        ? {
            model: {
              ...model,
              repliesStatus: 'ready',
              flags: { ...model.flags, tweet: { ...model.flags.tweet, replies } },
            },
          }
        : { model },
    FailedReplies: ({ slug }) =>
      model.flags.tweet?.post.slug === slug
        ? { model: { ...model, repliesStatus: 'error' } }
        : { model },
    GotPlayerMessage: ({ message }) => {
      const child = Player.update(model.player, message)

      return {
        model: { ...model, player: child.model },
        commands: Command.mapMessages(child.commands ?? [], (message) =>
          Message.GotPlayerMessage({ message }),
        ),
      }
    },
    GotCreatorMessage: ({ message }) => {
      const child = Creator.update(model.creator, message)

      return {
        model: { ...model, creator: child.model },
        commands: Command.mapMessages(child.commands ?? [], (message) =>
          Message.GotCreatorResult({ message, navigationId: model.navigationId }),
        ),
      }
    },
    GotCreatorResult: ({ message, navigationId }) =>
      navigationId === model.navigationId
        ? update(model, Message.GotCreatorMessage({ message }))
        : { model },
    GotDashboardMessage: ({ message }) => {
      const child = Dashboard.update(model.dashboard, message)

      return {
        model: { ...model, dashboard: child.model },
        commands: Command.mapMessages(child.commands ?? [], (message) =>
          Message.GotDashboardResult({ message, navigationId: model.navigationId }),
        ),
      }
    },
    GotDashboardResult: ({ message, navigationId }) =>
      navigationId === model.navigationId
        ? update(model, Message.GotDashboardMessage({ message }))
        : { model },
    RequestedUrl: ({ request }) =>
      UrlRequest.match<Update.Return<Model, Message, Services>>(request, {
        Internal: ({ url }) => ({
          model,
          commands: [
            isServerPath(url.pathname)
              ? Leave({ href: urlToString(url) })
              : Navigate({ href: urlToString(url) }),
          ],
        }),
        External: ({ href }) => ({ model, commands: [Leave({ href })] }),
      }),
    ChangedUrl: ({ url }) => {
      const href = urlToString(url)
      const key = pageKey(href)
      const navigationId = model.navigationId + 1

      const entry = isCacheable(key)
        ? AsyncData.fromOptionOrIdle(HashMap.get(model.pageCache, key))
        : AsyncData.Idle()

      const transition = AsyncData.revalidateOrLoad(entry)

      const pageCache = Option.match(transition, {
        onNone: () => model.pageCache,
        onSome: (next) =>
          isCacheable(key) ? HashMap.set(model.pageCache, key, next) : model.pageCache,
      })

      const leaving = {
        ...model,
        pageCache,
        menuOpen: false,
        navigationId,
        player: { ...model.player, fullscreen: false, queueOpen: false },
      }

      const commands = [
        ...(model.creator.uploadState === 'running' ? [PauseCreatorUpload()] : []),
        LoadPage({ href, navigationId }),
      ]

      return Option.match(AsyncData.getData(entry), {
        onNone: () => ({
          model: { ...leaving, loading: true, pendingPath: url.pathname },
          commands,
        }),
        onSome: (flags) => {
          const shown = showPage(leaving, flags, navigationId)

          return { ...shown, commands: [...commands, ...(shown.commands ?? [])] }
        },
      })
    },
    PrefetchRequested: ({ href }) => {
      const key = pageKey(href)

      if (!isCacheable(key)) return { model }

      return Option.match(
        AsyncData.loadIfMissing(AsyncData.fromOptionOrIdle(HashMap.get(model.pageCache, key))),
        {
          onNone: () => ({ model }),
          onSome: (loading) => ({
            model: { ...model, pageCache: HashMap.set(model.pageCache, key, loading) },
            commands: [PrefetchPage({ href })],
          }),
        },
      )
    },
    PrefetchedPage: ({ flags, key }) => ({
      model: {
        ...model,
        pageCache: settlePage(
          settlePage(model.pageCache, key, Result.succeed(flags)),
          pageKey(flags.url),
          Result.succeed(flags),
        ),
      },
    }),
    LoadedPage: ({ flags, key, navigationId }) => {
      const pageCache = settlePage(
        settlePage(model.pageCache, key, Result.succeed(flags)),
        pageKey(flags.url),
        Result.succeed(flags),
      )

      if (navigationId !== model.navigationId || (!model.loading && samePage(model.flags, flags)))
        return { model: { ...model, pageCache } }

      const shown = showPage(model, flags, navigationId)

      return { ...shown, model: { ...shown.model, pageCache } }
    },
    FailedPage: ({ key, navigationId }) => {
      const pageCache = settlePage(
        model.pageCache,
        key,
        Result.fail('This page could not be loaded.'),
      )

      return {
        model:
          navigationId === model.navigationId && model.loading
            ? {
                ...model,
                pageCache,
                loading: false,
                pendingPath: null,
                error: 'This page could not be loaded. Please try again.',
              }
            : { ...model, pageCache },
      }
    },
    NavigationCompleted: () => ({ model }),
  })

/** The page the screen is showing: the pending destination while loading, else the loaded page. */
export const displayedPath = (model: Model) =>
  model.loading && model.pendingPath ? model.pendingPath : new URL(model.flags.url).pathname

export const init: Runtime.ApplicationInit<Model, Message, Flags, Services> = (flags) => {
  const url = new URL(flags.url)
  const route = parseRoute(url.pathname)
  const role = flags.principal?.role ?? null

  const creatorKind = Match.value(route).pipe(
    Match.tag('Composer', ({ kind }) => kind),
    Match.orElse(() => ''),
  )

  const creator = Creator.init({
    kind: Match.value(creatorKind).pipe(
      Match.when('mix', () => 'mix' as const),
      Match.when('editorial', () => 'post' as const),
      Match.orElse(() => 'micro' as const),
    ),
    editSlug: url.searchParams.get('edit'),
    creatorId: flags.principal?.id ?? '',
    authorized: canCreatePosts(role),
  })

  const section = Match.value(route).pipe(
    Match.tag('Dashboard', ({ section }) => section),
    Match.tag('Static', ({ page }) => (page === 'spotify-callback' ? page : '')),
    Match.orElse(() => ''),
  )

  const dashboard = Dashboard.init(section || 'favorites', {
    id: flags.principal?.id ?? '',
    role: role && isRole(role) ? role : null,
  })()

  const preparedDashboard = flags.dashboard
    ? Dashboard.update(dashboard.model, Dashboard.Message.Loaded({ document: flags.dashboard }))
    : dashboard

  return {
    model: {
      route,
      flags,
      menuOpen: false,
      search: Search.initialModel,
      skipSeen: flags.skipSeen,
      loading: false,
      pendingPath: null,
      pageCache: seedCache(flags),
      interactive: false,
      navigationId: 0,
      error: null,
      repliesStatus: flags.tweet ? 'loading' : 'ready',
      player: Player.initialModel,
      publicAction: PublicActions.init(flags.publicAction),
      creator: creator.model,
      dashboard: preparedDashboard.model,
    },
    commands: [
      StartClient(),
      ...(flags.tweet
        ? [
            LoadReplies({ slug: flags.tweet.post.slug }),
            MarkSeen({ slug: flags.tweet.post.slug }),
            ...[
              ...new Set(
                [
                  flags.neighbours?.newer,
                  flags.neighbours?.older,
                  flags.neighbours?.olderUnread,
                ].flatMap((slug) => (slug ? [slug] : [])),
              ),
            ].map((slug) => PrefetchPage({ href: `/tweet/${encodeURIComponent(slug)}` })),
          ]
        : []),
      ...(creatorKind
        ? Command.mapMessages(creator.commands ?? [], (message) =>
            Message.GotCreatorResult({ message, navigationId: 0 }),
          )
        : []),
      ...(section && (flags.principal || section === 'spotify-callback')
        ? Command.mapMessages(preparedDashboard.commands ?? [], (message) =>
            Message.GotDashboardResult({ message, navigationId: 0 }),
          )
        : []),
    ],
  }
}

const nav = [
  ['/shows', 'Radio Shows'],
  ['/editorial', 'Editorial'],
  ['/tweets', 'Tweets'],
  ['/labels', 'Record Labels'],
] as const

const link = (h: HtmlBuilder<Message>, href: string, label: string, className = '') =>
  h.a([h.Href(href), h.Class(className)], [label])

const playItem = (item: ContentItem, url: string) =>
  Message.GotPlayerMessage({
    message: Player.Message.PlayTrack({
      track: {
        id: item.id,
        title: item.title,
        url,
        slug: item.slug,
        thumbnailUrl: item.imageUrl,
        type: item.audioType ?? 'mix',
        creators: item.creators,
      },
    }),
  })

const home = (model: Model, h: HtmlBuilder<Message>) => {
  const mix = model.flags.items[0]

  return h.section(
    [h.Class('home')],
    [
      h.h1([], ['goosebumps.', h.br([]), h.span([], ['fm'])]),
      h.div(
        [h.Class('featured')],
        [
          h.div(
            [h.Class('featured-art')],
            [
              artwork(mix?.imageUrl, mix?.title ?? 'goosebumps.fm', '320px', true),
              h.div(
                [h.Class('featured-overlay')],
                [
                  h.span([h.Class('featured-label')], ['Featured']),
                  h.div(
                    [],
                    [
                      mix
                        ? link(h, mix.href, mix.title, 'featured-title')
                        : h.p([], ['No featured mix available']),
                      mix?.creators
                        ? h.p(
                            [h.Class('featured-creators')],
                            [mix.creators.map((creator) => creator.name).join(', ')],
                          )
                        : h.empty,
                      mix?.audioUrl
                        ? h.button(
                            [
                              h.Disabled(!model.interactive),
                              h.OnClick(playItem(mix, mix.audioUrl)),
                            ],
                            ['▶ Play mix'],
                          )
                        : h.empty,
                    ],
                  ),
                ],
              ),
            ],
          ),
          link(h, '/shows', '◉ Browse radio shows', 'browse-shows'),
        ],
      ),
    ],
  )
}

const cards = (model: Model, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class('cards')],
    model.flags.items.map((item) =>
      h.article(
        [h.Class('card'), h.Key(item.id)],
        [
          artwork(item.imageUrl, '', '(max-width: 1023px) 45vw, 25vw'),
          h.div(
            [h.Class('card-copy')],
            [
              link(h, item.href, item.title, 'card-title'),
              item.meta ? h.small([], [item.meta]) : h.empty,
              item.description ? h.p([], [item.description]) : h.empty,
              item.audioUrl
                ? h.button(
                    [h.Disabled(!model.interactive), h.OnClick(playItem(item, item.audioUrl))],
                    ['Play'],
                  )
                : h.empty,
            ],
          ),
        ],
      ),
    ),
  )

const detail = (model: Model, h: HtmlBuilder<Message>, kind: string) => {
  const item = model.flags.items[0]

  if (!item)
    return h.section(
      [h.Class('page')],
      [h.p([h.Role('alert')], [model.flags.failure ?? 'Content not found.'])],
    )
  const current = model.player.snapshot.queue.current?.id === item.id
  const playing = current && model.player.snapshot.transport.isPlaying

  return h.article(
    [h.Class('content-detail')],
    [
      kind === 'mixes' ? link(h, '/shows', '← Radio shows') : h.empty,
      h.header(
        [],
        [
          artwork(item.imageUrl, item.title, '(max-width: 639px) 90vw, 240px', true),
          h.div(
            [],
            [
              h.p([h.Class('eyebrow')], [kind]),
              h.h1([], [item.title]),
              item.description ? h.p([], [item.description]) : h.empty,
              h.p(
                [h.Class('detail-creators')],
                (item.creators ?? []).map((creator) =>
                  link(
                    h,
                    `/profile/${encodeURIComponent(creator.username ?? creator.id)}`,
                    creator.name,
                  ),
                ),
              ),
              item.meta
                ? h.time(
                    [h.Datetime(item.meta)],
                    [
                      new Date(item.meta).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      }),
                    ],
                  )
                : h.empty,
            ],
          ),
        ],
      ),
      item.audioUrl
        ? h.div(
            [h.Class('detail-actions')],
            [
              h.button(
                [
                  h.Disabled(!model.interactive),
                  h.OnClick(
                    current
                      ? Message.GotPlayerMessage({ message: Player.Message.TogglePlayPause() })
                      : playItem(item, item.audioUrl),
                  ),
                ],
                [playing ? 'Pause' : 'Play'],
              ),
              h.button(
                [
                  h.Disabled(!model.interactive),
                  h.OnClick(
                    Message.GotPlayerMessage({
                      message: Player.Message.Enqueue({
                        track: {
                          id: item.id,
                          title: item.title,
                          url: item.audioUrl,
                          slug: item.slug,
                          thumbnailUrl: item.imageUrl,
                          type: item.audioType ?? 'mix',
                          creators: item.creators,
                        },
                      }),
                    }),
                  ),
                ],
                ['Add to queue'],
              ),
            ],
          )
        : h.empty,
      PublicActions.view(
        model.publicAction,
        h,
        (message) => Message.GotPublicActionMessage({ message }),
        model.interactive,
      ),
      h.nav(
        [h.Class('detail-actions'), h.AriaLabel('Listen on')],
        (item.streamingLinks ?? []).map((stream) =>
          h.a(
            [h.Href(stream.url), h.Target('_blank'), h.Rel('noopener noreferrer')],
            [stream.platform],
          ),
        ),
      ),
      h.nav(
        [h.Class('detail-actions'), h.AriaLabel('Content tags')],
        (item.tags ?? []).map((tag) => link(h, `/tags/${encodeURIComponent(tag)}`, `#${tag}`)),
      ),
      richContent(item.content),
    ],
  )
}

const auth = (h: HtmlBuilder<Message>, action: string, url: URL) =>
  action === 'verify-email'
    ? h.section(
        [h.Class('page narrow')],
        [
          h.h1([], ['Check your email']),
          h.p([], ['Use the verification link in your inbox to verify your account.']),
          link(h, '/auth/sign-in', 'Sign in'),
        ],
      )
    : h.section(
        [h.Class('auth-page')],
        [
          h.form(
            [h.Class('panel'), h.Method('post'), h.Action(`/auth/${action}`)],
            [
              url.searchParams.has('sent')
                ? h.p([h.Role('status')], ['Check your inbox for a password reset link.'])
                : h.empty,
              url.searchParams.has('reset')
                ? h.p(
                    [h.Role('status')],
                    ['Your password has been reset. Sign in with your new password.'],
                  )
                : h.empty,
              h.input([
                h.Type('hidden'),
                h.Name('token'),
                h.Value(url.searchParams.get('token') ?? ''),
              ]),
              h.input([
                h.Type('hidden'),
                h.Name('returnTo'),
                h.Value(url.searchParams.get('returnTo') ?? '/dashboard'),
              ]),
              h.h1(
                [],
                [
                  Match.value(action).pipe(
                    Match.when('sign-up', () => 'Create your account'),
                    Match.when('sign-in', () => 'Welcome back'),
                    Match.orElse(() => 'Reset your password'),
                  ),
                ],
              ),
              action === 'sign-up'
                ? h.label(
                    [],
                    ['Name', h.input([h.Name('name'), h.Required(true), h.Autocomplete('name')])],
                  )
                : h.empty,
              action === 'reset-password'
                ? h.empty
                : h.label(
                    [],
                    [
                      'Email',
                      h.input([
                        h.Type('email'),
                        h.Name('email'),
                        h.Required(true),
                        h.Autocomplete('email'),
                      ]),
                    ],
                  ),
              action !== 'forgot-password'
                ? h.label(
                    [],
                    [
                      'Password',
                      h.input([
                        h.Type('password'),
                        h.Name('password'),
                        h.Required(true),
                        h.Autocomplete(action === 'sign-in' ? 'current-password' : 'new-password'),
                      ]),
                    ],
                  )
                : h.empty,
              h.button(
                [h.Type('submit')],
                [
                  Match.value(action).pipe(
                    Match.when('sign-up', () => 'Sign up'),
                    Match.when('sign-in', () => 'Sign in'),
                    Match.orElse(() => 'Continue'),
                  ),
                ],
              ),
              link(
                h,
                action === 'sign-in' ? '/auth/sign-up' : '/auth/sign-in',
                action === 'sign-in' ? 'Create an account' : 'Sign in',
              ),
              action === 'sign-in' ? link(h, '/auth/forgot-password', 'Forgot password?') : h.empty,
            ],
          ),
        ],
      )

const tweetArrow = (
  h: HtmlBuilder<Message>,
  direction: 'newer' | 'older',
  slug: string | null | undefined,
  flank: boolean,
) => {
  const path = direction === 'newer' ? iconPaths.chevronLeft : iconPaths.chevronRight
  const iconClassName = flank ? 'h-6 w-6' : 'h-4 w-4'

  const base = flank
    ? `fixed top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors lg:flex ${
        direction === 'newer'
          ? 'left-[max(1rem,calc(50%-30rem))]'
          : 'right-[max(1rem,calc(50%-30rem))]'
      }`
    : 'inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors'

  if (!slug)
    return h.span(
      [h.AriaHidden(true), h.Class(`${base} cursor-not-allowed text-muted-foreground/20`)],
      [lucide(path, iconClassName)],
    )

  return h.a(
    [
      ...(flank ? [h.Id(`tweet-${direction}`)] : []),
      h.Href(`/tweet/${encodeURIComponent(slug)}`),
      h.AriaLabel(direction === 'newer' ? 'Newer tweet' : 'Older tweet'),
      h.Class(`${base} no-underline hover:bg-muted/60 hover:text-foreground`),
    ],
    [lucide(path, iconClassName)],
  )
}

const tweetView = (model: Model, h: HtmlBuilder<Message>) => {
  const screen = model.flags.tweet

  if (!screen)
    return h.div(
      [h.Class('max-w-3xl px-4 pt-8 mx-auto')],
      [h.p([h.Role('alert')], [model.flags.failure ?? 'Tweet not found.'])],
    )
  const neighbours = model.flags.neighbours
  const older = model.skipSeen ? (neighbours?.olderUnread ?? neighbours?.older) : neighbours?.older
  const post = screen.post
  const principal = model.flags.principal

  const canEdit = (candidate: TweetPost) =>
    Boolean(
      principal &&
      (principal.role === 'admin' ||
        candidate.creators?.some((creator) => creator.id === principal.id)),
    )

  const editedAt = post.updatedAt > post.createdAt ? post.updatedAt : null
  const replies = screen.replies

  return h.div(
    [h.Class('max-w-3xl px-4 py-8 mx-auto')],
    [
      tweetWayfinder(neighbours, post.createdAt, model.flags.renderedAt),
      h.div(
        [h.Class('mb-6 flex items-center gap-1 text-xs text-muted-foreground')],
        [
          h.div(
            [h.Class('flex items-center gap-1 lg:hidden')],
            [
              tweetArrow(h, 'newer', neighbours?.newer, false),
              tweetArrow(h, 'older', older, false),
            ],
          ),
          h.form(
            [h.Method('post'), h.Action('/actions/tweet-random'), h.Class('m-0')],
            [
              h.input([h.Type('hidden'), h.Name('slug'), h.Value(post.slug)]),
              h.button(
                [
                  h.Type('submit'),
                  h.Disabled(!neighbours?.unreadCount),
                  h.Class(
                    'inline-flex h-8 items-center gap-1.5 rounded-sm border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40',
                  ),
                ],
                [lucide(iconPaths.shuffle, 'h-3.5 w-3.5'), 'Random unread'],
              ),
            ],
          ),
          h.label(
            [h.Class('ml-auto inline-flex cursor-pointer items-center gap-2')],
            [
              h.input([
                h.Type('checkbox'),
                h.Disabled(!model.interactive),
                h.Checked(model.skipSeen),
                h.OnClick(Message.SkipSeenChanged({ value: !model.skipSeen })),
              ]),
              'Skip seen',
            ],
          ),
        ],
      ),
      tweetArrow(h, 'newer', neighbours?.newer, true),
      tweetArrow(h, 'older', older, true),
      new URL(model.flags.url).searchParams.has('random')
        ? h.p(
            [h.Role('alert'), h.Class('mb-4 text-sm text-destructive')],
            ['No unread tweet could be loaded. Try again.'],
          )
        : h.empty,
      post.parentPostId && screen.root.id !== post.id ? parentPreview(screen.root) : h.empty,
      h.article(
        [
          h.Class(
            'space-y-4 rounded-lg border border-border/60 bg-card/60 p-4 shadow-sm sm:p-5 animate-in fade-in duration-300',
          ),
        ],
        [
          h.div(
            [h.Class('space-y-1')],
            [
              authorRow(post.creators ?? [], post.createdAt),
              editedAt
                ? h.p(
                    [
                      h.Class(
                        'pl-[52px] font-mono text-[11px] tracking-wider text-muted-foreground/60',
                      ),
                    ],
                    [`Edited ${formatDate(editedAt)}`],
                  )
                : h.empty,
            ],
          ),
          post.title
            ? h.h1([h.Class('m-0 text-lg font-medium leading-snug tracking-tight')], [post.title])
            : h.empty,
          tweetBody(post, 'base'),
          post.music ? musicCard(post.music, true) : h.empty,
          screen.quote ? quoteCard(screen.quote) : h.empty,
          post.tags?.length ? h.div([h.Class('pt-1')], [tagLinks(post.tags)]) : h.empty,
          h.div(
            [h.Class('border-t border-border/40 pt-3')],
            [cardActions(post, canEdit(post), replies.length)],
          ),
        ],
      ),
      h.div(
        [h.Id('replies'), h.Class('mt-6 scroll-mt-4 space-y-4')],
        [
          principal
            ? h.form(
                [
                  h.Method('post'),
                  h.Action(`/actions/reply?slug=${encodeURIComponent(post.slug)}`),
                  h.Class('space-y-2 rounded-lg border border-border/60 bg-card/60 p-3'),
                ],
                [
                  h.textarea([
                    h.Name('content'),
                    h.Required(true),
                    h.Placeholder('Write a reply…'),
                    h.AriaLabel('Reply'),
                    h.Class(
                      'h-20 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm',
                    ),
                  ]),
                  h.div(
                    [h.Class('flex justify-end')],
                    [
                      h.button(
                        [
                          h.Type('submit'),
                          h.Class(
                            'inline-flex h-8 items-center rounded-sm border-0 bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                          ),
                        ],
                        ['Reply'],
                      ),
                    ],
                  ),
                ],
              )
            : h.p(
                [h.Class('text-base')],
                [
                  h.a(
                    [h.Href(`/auth/sign-in?returnTo=${encodeURIComponent(`/tweet/${post.slug}`)}`)],
                    ['Sign in'],
                  ),
                  ' to reply',
                ],
              ),
          model.repliesStatus === 'loading' ? replySkeleton() : h.empty,
          model.repliesStatus === 'error'
            ? h.p(
                [h.Role('alert'), h.Class('text-sm text-muted-foreground')],
                ['Replies are unavailable. Please reload to try again.'],
              )
            : h.empty,
          replies.length > 0
            ? h.div(
                [],
                replies.map((reply, index) =>
                  replyCard(reply, index === replies.length - 1, canEdit(reply)),
                ),
              )
            : h.empty,
        ],
      ),
    ],
  )
}

/** The show list any loaded or cached page already holds, so a show can render before its episodes arrive. */
const knownShows = (model: Model) =>
  model.flags.shows ??
  Array.from(HashMap.values(model.pageCache))
    .flatMap((entry) => Option.toArray(AsyncData.getData(entry)))
    .find((flags) => flags.shows !== null)?.shows ??
  null

const pendingShowSlug = (route: Route, shows: ShowsDocument) =>
  Match.value(route).pipe(
    Match.tag('Detail', ({ kind, slug }) =>
      kind === 'shows' && shows.shows.some((show) => show.slug === slug) ? slug : null,
    ),
    Match.tag('Listing', ({ kind }) => (kind === 'shows' ? shows.selectedSlug : null)),
    Match.orElse(() => null),
  )

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const playback = {
    prefetch: (href: string) => Message.PrefetchRequested({ href }),
    play: (episode: Episode) =>
      Message.GotPlayerMessage({ message: Player.Message.PlayTrack({ track: episode }) }),
    toggle: Message.GotPlayerMessage({ message: Player.Message.TogglePlayPause() }),
    currentId: model.player.snapshot.queue.current?.id ?? null,
    isPlaying: model.player.snapshot.transport.isPlaying,
  }

  const page =
    model.flags.status === 404
      ? h.section([h.Class('page')], [h.h1([], ['Page not found']), link(h, '/', 'Return home')])
      : model.flags.shows
        ? showsView(
            model.flags.shows,
            h,
            playback,
            PublicActions.view(
              model.publicAction,
              h,
              (message) => Message.GotPublicActionMessage({ message }),
              model.interactive,
            ),
            model.interactive,
          )
        : Route.match(model.route, {
            Home: () => home(model, h),
            Listing: ({ kind }) =>
              kind === 'editorial'
                ? editorialList(
                    model.flags.items,
                    model.flags.renderedAt,
                    model.flags.failure ?? null,
                  )
                : h.section(
                    [h.Class('page')],
                    [
                      h.h1([], [model.flags.title]),
                      model.flags.failure ? h.p([h.Role('alert')], [model.flags.failure]) : h.empty,
                      kind === 'tags'
                        ? model.flags.items.length
                          ? h.nav(
                              [h.Class('detail-actions'), h.AriaLabel('Tags')],
                              model.flags.items.map((item) => link(h, item.href, item.title)),
                            )
                          : h.p([], ['No tags yet.'])
                        : cards(model, h),
                    ],
                  ),
            Detail: ({ kind }) =>
              kind === 'tweets'
                ? tweetView(model, h)
                : kind === 'tags'
                  ? h.section(
                      [h.Class('page')],
                      [
                        h.h1([], [model.flags.title]),
                        model.flags.failure
                          ? h.p([h.Role('alert')], [model.flags.failure])
                          : model.flags.items.length === 0
                            ? h.p([], ['No posts with this tag yet.'])
                            : cards(model, h),
                      ],
                    )
                  : model.flags.profile
                    ? profileView(model.flags.profile)
                    : detail(model, h, kind),
            Auth: ({ action }) => auth(h, action, new URL(model.flags.url)),
            Composer: () =>
              h.submodel({
                slotId: 'creator',
                view: Creator.view,
                model: model.creator,
                viewInputs: { role: model.flags.principal?.role ?? null },
                toParentMessage: (message) => Message.GotCreatorMessage({ message }),
              }),
            Dashboard: () =>
              model.flags.principal
                ? h.submodel({
                    slotId: 'dashboard',
                    view: Dashboard.view,
                    model: model.dashboard,
                    viewInputs: { role: model.dashboard.principal.role, url: model.flags.url },
                    toParentMessage: (message) => Message.GotDashboardMessage({ message }),
                  })
                : auth(h, 'sign-in', new URL(model.flags.url)),
            Static: ({ page }) =>
              page === 'invite/charlie3000'
                ? invitationView()
                : page === 'spotify-callback'
                  ? h.submodel({
                      slotId: 'dashboard',
                      view: Dashboard.view,
                      model: model.dashboard,
                      viewInputs: { role: model.dashboard.principal.role, url: model.flags.url },
                      toParentMessage: (message) => Message.GotDashboardMessage({ message }),
                    })
                  : ['subscribe', 'unsubscribe'].includes(page)
                    ? newsletterView(page, new URL(model.flags.url))
                    : h.article(
                        [h.Class('page prose')],
                        [
                          h.h1([], [model.flags.title]),
                          ...(staticPages.get(page)?.paragraphs ?? []).map((text) =>
                            h.p([h.Class('content-paragraph')], [text]),
                          ),
                          page === 'changelog' ? richContent(model.flags.changelog ?? '') : h.empty,
                        ],
                      ),
            NotFound: () =>
              h.section(
                [h.Class('page')],
                [h.h1([], ['Page not found']), link(h, '/', 'Return home')],
              ),
          })

  const target = model.loading && model.pendingPath ? parseRoute(model.pendingPath) : null
  const shows = target ? knownShows(model) : null
  const showSlug = target && shows ? pendingShowSlug(target, shows) : null

  const pendingShow =
    shows && showSlug
      ? showsView(
          { ...shows, selectedSlug: showSlug, episodes: null },
          h,
          playback,
          h.empty,
          model.interactive,
          true,
        )
      : null

  const content = pendingShow ?? (target ? pageSkeleton(target, model.route) : null) ?? page

  return {
    title:
      model.flags.title === 'goosebumps.fm'
        ? model.flags.title
        : `${model.flags.title} | goosebumps.fm`,
    lang: 'en',
    canonical:
      model.flags.metadata?.canonicalUrl ??
      `https://goosebumps.fm${new URL(model.flags.url).pathname}`,
    ogUrl:
      model.flags.metadata?.canonicalUrl ??
      `https://goosebumps.fm${new URL(model.flags.url).pathname}`,
    body: h.div(
      [h.Class('site'), h.DataAttribute('interactive', String(model.interactive))],
      [
        stationNav(h, {
          pathname: model.pendingPath ?? new URL(model.flags.url).pathname,
          links: nav,
          accountName: model.flags.principal
            ? (model.flags.principal.name ?? model.flags.principal.username ?? '?')
            : null,
          interactive: model.interactive,
          menuOpen: model.menuOpen,
          nowPlaying: model.player.snapshot.queue.current
            ? {
                title: model.player.snapshot.queue.current.title,
                thumbnailUrl: model.player.snapshot.queue.current.thumbnailUrl ?? null,
                isPlaying: model.player.snapshot.transport.isPlaying,
                progress: model.player.snapshot.transport.duration
                  ? (model.player.snapshot.transport.currentTime /
                      model.player.snapshot.transport.duration) *
                    100
                  : 0,
              }
            : null,
          togglePlay: Message.GotPlayerMessage({ message: Player.Message.TogglePlayPause() }),
          openPlayer: Message.GotPlayerMessage({ message: Player.Message.ToggleFullscreen() }),
          openSearch: Message.GotSearchMessage({ message: Search.Message.Opened() }),
          toggleMenu: Message.MenuToggled(),
        }),
        model.menuOpen
          ? h.aside(
              [h.Class('menu-sheet'), h.AriaLabel('Menu')],
              [
                h.header(
                  [],
                  [
                    h.h2([], ['Menu']),
                    h.button([h.AriaLabel('Close menu'), h.OnClick(Message.MenuToggled())], ['×']),
                  ],
                ),
                h.h3([], ['Browse']),
                ...nav.map(([href, label]) => link(h, href, label)),
                link(h, '/mixes', 'Mixes'),
                link(h, '/subscribe', 'Subscribe'),
                ...(canCreatePosts(model.flags.principal?.role ?? null)
                  ? [
                      h.h3([], ['Create']),
                      link(h, '/new', 'New post'),
                      link(h, '/mix-upload', 'New mix'),
                      link(h, '/dashboard/content', 'My content'),
                    ]
                  : []),
                h.h3([], ['Follow']),
                link(h, '/rss.xml', 'Mixes via RSS'),
                link(h, 'https://youtube.com/@goosebumpsfm', 'Mixes via YouTube'),
                link(
                  h,
                  model.flags.principal ? '/dashboard' : '/auth/sign-in',
                  model.flags.principal ? 'Dashboard' : 'Log in',
                ),
                model.flags.principal
                  ? h.form(
                      [h.Method('post'), h.Action('/actions/sign-out')],
                      [h.button([h.Type('submit')], ['Sign out'])],
                    )
                  : h.empty,
              ],
            )
          : h.empty,
        h.submodel({
          slotId: 'search',
          model: model.search,
          view: Search.view,
          toParentMessage: (message) => Message.GotSearchMessage({ message }),
        }),
        model.loading
          ? h.div(
              [
                h.Class(
                  'pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden animate-in fade-in duration-200 delay-150 fill-mode-both',
                ),
                h.Role('status'),
                h.AriaLive('polite'),
                h.AriaLabel('Loading page'),
              ],
              [
                h.div(
                  [
                    h.Class(
                      'h-full w-2/5 bg-highlight shadow-[0_0_8px_var(--highlight)] motion-safe:animate-[navigation-sweep_1.1s_cubic-bezier(0.65,0,0.35,1)_infinite] motion-reduce:w-full motion-reduce:opacity-60',
                    ),
                  ],
                  [],
                ),
              ],
            )
          : h.empty,
        model.error
          ? h.p(
              [h.Role('alert'), h.Class('mx-auto max-w-5xl px-4 pt-6 text-sm text-destructive')],
              [model.error],
            )
          : h.empty,
        h.main(
          [],
          [
            (Route.guards.Dashboard(model.route) && model.dashboard.section !== 'users') ||
            Route.guards.Composer(model.route)
              ? h.fieldset([h.Class('contents'), h.Disabled(!model.interactive)], [content])
              : content,
          ],
        ),
        h.submodel({
          slotId: 'player',
          model: model.player,
          view: Player.view,
          toParentMessage: (message) => Message.GotPlayerMessage({ message }),
        }),
        h.footer(
          [h.Class('mx-auto flex w-full max-w-5xl gap-5 px-4 pb-8 pt-12 text-xs')],
          [
            ['/privacy', 'Privacy'],
            ['/terms', 'Terms'],
            ['/rss.xml', 'RSS'],
          ].map(([href, label]) =>
            h.a(
              [
                h.Key(href),
                h.Href(href),
                h.Class(
                  'text-muted-foreground no-underline transition-colors hover:text-foreground',
                ),
              ],
              [label],
            ),
          ),
        ),
      ],
    ),
  }
}

export const applicationConfig = {
  Flags,
  Model,
  init,
  update,
  view,
  routing: {
    onUrlRequest: (request: UrlRequest) => Message.RequestedUrl({ request }),
    onUrlChange: (url: Url) => Message.ChangedUrl({ url }),
  },
}

export const clientResources = Layer.mergeAll(
  Player.playerClientLayer,
  Creator.CreatorServiceLive,
  Creator.CreatorUploadLive,
  Dashboard.DashboardServiceLive,
  Dashboard.SessionServiceLive,
  SpotifyConnectionLive,
)

export const subscriptions = Subscription.aggregate(
  Subscription.lift(Player.subscriptions)<Model, Message>({
    toChildModel: (model) => model.player,
    toParentMessage: (message) => Message.GotPlayerMessage({ message }),
  }),
  Subscription.lift(Creator.subscriptions)<Model, Message>({
    toChildModel: (model) => model.creator,
    toParentMessage: (message) => Message.GotCreatorMessage({ message }),
  }),
)
