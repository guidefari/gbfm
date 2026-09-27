import { AudioResponse } from '@gbfm/api/audio'
import { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import { MicroPostScreenResponse, MicroPostScreenRepliesResponse } from '@gbfm/api/post'
import { PublicProfileResponse } from '@gbfm/api/profile'
import { ReleaseResponse } from '@gbfm/api/release'
import { canCreatePosts, isRole } from '@gbfm/core/roles'
import { SiteMetadata } from '@gbfm/site-metadata'
import { Effect, Layer, Match, Schema } from 'effect'
import { Command, Navigation, Subscription, type Runtime, type Update } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest } from 'foldkit/navigation'
import { Url, toString as urlToString } from 'foldkit/url'

import { artwork } from './artwork'
import * as Creator from './creator'
import * as Dashboard from './dashboard'
import { DashboardDocument } from './dashboard/document'
import { updateDocumentHead } from './document-head'
import { invitationView } from './invitation'
import { newsletterView } from './newsletter'
import * as Player from './player'
import * as PublicActions from './public-actions'
import { profileView } from './public-profile'
import { richContent } from './rich-content'
import * as Search from './search'
import { ShowsDocument, showsView } from './shows'
import { type SpotifyConnection, SpotifyConnectionLive } from './spotify'
import { staticPages } from './static-pages'
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

export const Model = Schema.Struct({
  route: Route,
  flags: Flags,
  menuOpen: Schema.Boolean,
  search: Search.Model,
  skipSeen: Schema.Boolean,
  loading: Schema.Boolean,
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
  GotDashboardMessage: { message: Dashboard.Message },
  RequestedUrl: { request: UrlRequest },
  ChangedUrl: { url: Url },
  LoadedPage: { flags: Flags, navigationId: Schema.Number },
  FailedPage: { navigationId: Schema.Number },
  LoadedReplies: { slug: Schema.String, replies: MicroPostScreenRepliesResponse },
  FailedReplies: { slug: Schema.String },
  NavigationCompleted: {},
})

export type Message = typeof Message.Type

type Services =
  | Player.PlayerClient
  | Creator.CreatorService
  | Dashboard.DashboardService
  | SpotifyConnection

const StartClient = Command.define('Application.Start', {
  messages: [Message.ClientStarted],
  execute: Effect.succeed(Message.ClientStarted()),
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

const LoadPage = Command.define('Navigation.Load', {
  args: { href: Schema.String, navigationId: Schema.Number },
  messages: [Message.LoadedPage, Message.FailedPage],
  execute: ({ href, navigationId }) =>
    Effect.tryPromise(async (signal) => {
      window.dispatchEvent(new Event('gbfm:navigation-start'))
      const url = new URL(href)
      url.searchParams.set('__data', '1')

      const response = await fetch(url, {
        headers: { accept: 'text/html' },
        credentials: 'same-origin',
        signal,
      })

      return await response.json()
    }).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Flags)),
      Effect.tap(() =>
        Effect.sync(() => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => window.dispatchEvent(new Event('gbfm:navigation-end'))),
          )
        }),
      ),
      Effect.map((flags) => Message.LoadedPage({ flags, navigationId })),
      Effect.catch(() => Effect.succeed(Message.FailedPage({ navigationId }))),
    ),
})

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
          Message.GotCreatorMessage({ message }),
        ),
      }
    },
    GotDashboardMessage: ({ message }) => {
      const child = Dashboard.update(model.dashboard, message)

      return {
        model: { ...model, dashboard: child.model },
        commands: Command.mapMessages(child.commands ?? [], (message) =>
          Message.GotDashboardMessage({ message }),
        ),
      }
    },
    RequestedUrl: ({ request }) =>
      UrlRequest.match<Update.Return<Model, Message, Services>>(request, {
        Internal: ({ url }) => ({ model, commands: [Navigate({ href: urlToString(url) })] }),
        External: ({ href }) => ({ model, commands: [Leave({ href })] }),
      }),
    ChangedUrl: ({ url }) => ({
      model: { ...model, loading: true, menuOpen: false, navigationId: model.navigationId + 1 },
      commands: [LoadPage({ href: urlToString(url), navigationId: model.navigationId + 1 })],
    }),
    LoadedPage: ({ flags, navigationId }) => {
      if (navigationId !== model.navigationId) return { model }
      const next = init(flags)

      return {
        ...next,
        model: {
          ...next.model,
          player: model.player,
          skipSeen: model.skipSeen,
          menuOpen: model.menuOpen,
          search: model.search,
          navigationId,
        },
        commands: [
          ...(next.commands ?? []),
          SetResolvedUrl({
            href: flags.url,
            metadata: flags.metadata,
            noindex:
              flags.status !== 200 ||
              Route.guards.Dashboard(next.model.route) ||
              Route.guards.Composer(next.model.route) ||
              Route.guards.Auth(next.model.route) ||
              (Route.guards.Static(next.model.route) &&
                next.model.route.page === 'spotify-callback'),
          }),
        ],
      }
    },
    FailedPage: ({ navigationId }) => ({
      model:
        navigationId === model.navigationId
          ? { ...model, loading: false, error: 'This page could not be loaded. Please try again.' }
          : model,
    }),
    NavigationCompleted: () => ({ model }),
  })

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

  return {
    model: {
      route,
      flags,
      menuOpen: false,
      search: Search.initialModel,
      skipSeen: flags.skipSeen,
      loading: false,
      interactive: false,
      navigationId: 0,
      error: null,
      repliesStatus: flags.tweet ? 'loading' : 'ready',
      player: Player.initialModel,
      publicAction: PublicActions.init(flags.publicAction),
      creator: creator.model,
      dashboard: flags.dashboard
        ? { ...dashboard.model, ...flags.dashboard, phase: 'ready' }
        : dashboard.model,
    },
    commands: [
      StartClient(),
      ...(flags.tweet
        ? [LoadReplies({ slug: flags.tweet.post.slug }), MarkSeen({ slug: flags.tweet.post.slug })]
        : []),
      ...(creatorKind
        ? Command.mapMessages(creator.commands ?? [], (message) =>
            Message.GotCreatorMessage({ message }),
          )
        : []),
      ...(section && (flags.principal || section === 'spotify-callback') && !flags.dashboard
        ? Command.mapMessages(dashboard.commands ?? [], (message) =>
            Message.GotDashboardMessage({ message }),
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

const icon = (h: HtmlBuilder<Message>, path: string) =>
  h.svg(
    [
      h.ViewBox('0 0 24 24'),
      h.Fill('none'),
      h.Stroke('currentColor'),
      h.StrokeWidth('1.75'),
      h.AriaHidden(true),
    ],
    [h.path([h.D(path)])],
  )

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

const tweetView = (model: Model, h: HtmlBuilder<Message>) => {
  const screen = model.flags.tweet

  if (!screen) return h.p([], [model.flags.failure ?? 'Tweet not found.'])
  const neighbours = model.flags.neighbours
  const older = model.skipSeen ? (neighbours?.olderUnread ?? neighbours?.older) : neighbours?.older

  const postView = (post: typeof screen.post) =>
    h.article(
      [h.Class('tweet-post')],
      [
        h.small(
          [],
          [
            post.creators?.map((creator) => creator.name).join(', ') ?? 'goosebumps.fm',
            ' · ',
            post.createdAt.slice(0, 10),
          ],
        ),
        post.title ? h.h2([], [post.title]) : h.empty,
        richContent(post.content ?? ''),
        post.music
          ? h.section(
              [h.Class('music-attachment')],
              [
                post.music.entity.coverImageUrl
                  ? h.img([h.Src(post.music.entity.coverImageUrl), h.Alt('')])
                  : h.empty,
                h.h3([], [post.music.entity.title]),
                ...post.music.links.map((item) => link(h, item.url, item.platform)),
              ],
            )
          : h.empty,
        h.div(
          [],
          (post.tags ?? []).map((tag) => link(h, `/tags/${encodeURIComponent(tag)}`, `#${tag}`)),
        ),
      ],
    )

  return h.section(
    [h.Class('page tweet-detail')],
    [
      tweetWayfinder(neighbours, screen.post.createdAt, model.flags.renderedAt),
      postView(screen.post),
      screen.quote ? h.blockquote([], [postView(screen.quote)]) : h.empty,
      h.nav(
        [h.AriaLabel('Tweet navigation')],
        [
          neighbours?.newer
            ? h.a(
                [h.Id('tweet-newer'), h.Href(`/tweet/${encodeURIComponent(neighbours.newer)}`)],
                ['Newer'],
              )
            : h.span([h.AriaDisabled(true)], ['Newer']),
          older
            ? h.a([h.Id('tweet-older'), h.Href(`/tweet/${encodeURIComponent(older)}`)], ['Older'])
            : h.span([h.AriaDisabled(true)], ['Older']),
          h.form(
            [h.Method('post'), h.Action('/actions/tweet-random')],
            [
              h.input([h.Type('hidden'), h.Name('slug'), h.Value(screen.post.slug)]),
              h.button(
                [h.Type('submit'), h.Disabled(!neighbours?.unreadCount)],
                ['Random unread tweet'],
              ),
            ],
          ),
          h.label(
            [],
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
      h.h2([], ['Replies']),
      new URL(model.flags.url).searchParams.has('random')
        ? h.p([h.Role('alert')], ['No unread tweet could be loaded. Try again.'])
        : h.empty,
      model.repliesStatus === 'loading' ? h.p([h.Role('status')], ['Loading replies…']) : h.empty,
      model.repliesStatus === 'error'
        ? h.p([h.Role('alert')], ['Replies are unavailable. Please reload to try again.'])
        : h.empty,
      model.repliesStatus === 'ready' && screen.replies.length === 0
        ? h.p([], ['No replies yet.'])
        : h.empty,
      ...screen.replies.map(postView),
      model.flags.principal
        ? h.form(
            [
              h.Method('post'),
              h.Action(`/actions/reply?slug=${encodeURIComponent(screen.post.slug)}`),
            ],
            [
              h.label([], ['Reply', h.textarea([h.Name('content'), h.Required(true)])]),
              h.button([h.Type('submit')], ['Post reply']),
            ],
          )
        : link(h, '/auth/sign-in', 'Sign in to reply'),
    ],
  )
}

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const content =
    model.flags.status === 404
      ? h.section([h.Class('page')], [h.h1([], ['Page not found']), link(h, '/', 'Return home')])
      : model.flags.shows
        ? showsView(
            model.flags.shows,
            h,
            (episode) =>
              Message.GotPlayerMessage({ message: Player.Message.PlayTrack({ track: episode }) }),
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
              h.section(
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
                    viewInputs: { role: model.dashboard.principal.role },
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
                      viewInputs: { role: model.dashboard.principal.role },
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
      [h.Class('site')],
      [
        h.nav(
          [h.Class('topbar'), h.AriaLabel('Primary')],
          [
            h.a(
              [h.Href('/'), h.Class('brand'), h.AriaLabel('goosebumps.fm home')],
              [h.span([h.Class('wordmark'), h.AriaHidden(true)], [])],
            ),
            h.div(
              [h.Class('nav desktop-links')],
              nav.map(([href, label]) =>
                h.a(
                  [
                    h.Href(href),
                    h.AriaCurrent(
                      new URL(model.flags.url).pathname.startsWith(href) ? 'page' : 'false',
                    ),
                  ],
                  [label],
                ),
              ),
            ),
            h.button(
              [
                h.Class('desktop-search'),
                h.AriaLabel('Search'),
                h.Disabled(!model.interactive),
                h.OnClick(Message.GotSearchMessage({ message: Search.Message.Opened() })),
              ],
              [icon(h, 'M21 21l-4.3-4.3 M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0')],
            ),
            link(
              h,
              model.flags.principal ? '/dashboard' : '/auth/sign-in',
              model.flags.principal?.name ?? 'Sign in',
              'account-link',
            ),
            h.div(
              [h.Class('mobile-tabs')],
              [
                model.player.snapshot.queue.current
                  ? h.button(
                      [
                        h.AriaLabel('Now playing'),
                        h.OnClick(
                          Message.GotPlayerMessage({ message: Player.Message.ToggleFullscreen() }),
                        ),
                      ],
                      [icon(h, 'M9 5l10 7-10 7z')],
                    )
                  : h.a(
                      [h.Href('/shows'), h.AriaLabel('Now playing')],
                      [
                        icon(
                          h,
                          'M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0 M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0',
                        ),
                      ],
                    ),
                h.a(
                  [h.Href('/shows'), h.AriaLabel('Shows')],
                  [
                    icon(
                      h,
                      'M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0 M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0',
                    ),
                  ],
                ),
                h.a(
                  [h.Href('/editorial'), h.AriaLabel('Editorial')],
                  [
                    icon(
                      h,
                      'M12 7v14 M3 3h5a4 4 0 0 1 4 4a4 4 0 0 1 4-4h5v16h-5a4 4 0 0 0-4 2a4 4 0 0 0-4-2H3z',
                    ),
                  ],
                ),
                h.button(
                  [
                    h.AriaLabel('Search'),
                    h.Disabled(!model.interactive),
                    h.OnClick(Message.GotSearchMessage({ message: Search.Message.Opened() })),
                  ],
                  [icon(h, 'M21 21l-4.3-4.3 M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0')],
                ),
                h.button(
                  [
                    h.AriaLabel('Menu'),
                    h.Disabled(!model.interactive),
                    h.AriaExpanded(model.menuOpen),
                    h.OnClick(Message.MenuToggled()),
                  ],
                  [icon(h, 'M4 6h16 M4 12h16 M4 18h16')],
                ),
              ],
            ),
          ],
        ),
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
          ? h.div([h.Role('progressbar'), h.AriaLabel('Loading page')], ['Loading…'])
          : h.empty,
        model.error ? h.p([h.Role('alert')], [model.error]) : h.empty,
        h.main(
          [],
          [
            Route.guards.Dashboard(model.route) || Route.guards.Composer(model.route)
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
          [],
          [link(h, '/privacy', 'Privacy'), link(h, '/terms', 'Terms'), link(h, '/rss.xml', 'RSS')],
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
  Dashboard.DashboardServiceLive,
  SpotifyConnectionLive,
)

export const subscriptions = Subscription.lift(Player.subscriptions)<Model, Message>({
  toChildModel: (model) => model.player,
  toParentMessage: (message) => Message.GotPlayerMessage({ message }),
})
