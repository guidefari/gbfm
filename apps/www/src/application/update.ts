import { MicroPostScreenRepliesResponse } from '@gbfm/api/post'
import { canCreatePosts, isRole } from '@gbfm/core/roles'
import { SiteMetadata } from '@gbfm/site-metadata'
import { Effect, HashMap, Layer, Match, Option, Result, Schema } from 'effect'
import { AsyncData, Command, Navigation, Subscription, type Runtime, type Update } from 'foldkit'
import { UrlRequest } from 'foldkit/navigation'
import { toString as urlToString } from 'foldkit/url'

import { preloadArtwork } from '../artwork'
import * as Creator from '../creator'
import * as Dashboard from '../dashboard'
import { updateDocumentHead } from '../document-head'
import { isCacheable, pageKey, samePage } from '../page-cache'
import * as Player from '../player'
import * as PublicActions from '../public-actions'
import * as Search from '../search'
import { showImages } from '../shows'
import { type SpotifyConnection, SpotifyConnectionLive } from '../spotify'
import { tweetImages } from '../tweet-card'
import { Message } from './message'
import { Flags, type Model, type PageCache } from './model'
import { isServerPath, parseRoute, Route } from './route'

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
