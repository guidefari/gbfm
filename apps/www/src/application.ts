import { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import { MicroPostScreenResponse, MicroPostScreenRepliesResponse } from '@gbfm/api/post'
import { canCreatePosts, isRole } from '@gbfm/core/roles'
import { Effect, Layer, Match, Schema } from 'effect'
import { Command, Navigation, Subscription, type Runtime, type Update } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest } from 'foldkit/navigation'
import { Url, toString as urlToString } from 'foldkit/url'

import * as Creator from './creator'
import * as Dashboard from './dashboard'
import { DashboardDocument } from './dashboard/document'
import * as Player from './player'
import { staticPages } from './static-pages'

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
  tweet: Schema.NullOr(MicroPostScreenResponse),
  neighbours: Schema.NullOr(MicroPostNeighboursResponse),
  dashboard: Schema.NullOr(DashboardDocument),
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

  if (parts.length > 2) return Route.cases.NotFound.make({})

  if (
    first === 'auth' &&
    second &&
    ['sign-in', 'sign-up', 'forgot-password', 'reset-password', 'verify-email'].includes(second)
  )
    return Route.cases.Auth.make({ action: second })

  if (first === 'new') return Route.cases.Composer.make({ kind: second ?? 'chooser' })

  if (first === 'mix-upload') return Route.cases.Composer.make({ kind: 'mix' })

  if (['privacy', 'terms', 'changelog'].includes(first) && !second)
    return Route.cases.Static.make({ page: first })

  if (listingKinds.has(first))
    return second
      ? Route.cases.Detail.make({ kind: first, slug: second })
      : Route.cases.Listing.make({ kind: first })

  if (first === 'profile' && second) return Route.cases.Detail.make({ kind: first, slug: second })

  if (first === 'tweet' && second) return Route.cases.Detail.make({ kind: 'tweets', slug: second })

  return Route.cases.NotFound.make({})
}

export const Model = Schema.Struct({
  route: Route,
  flags: Flags,
  menuOpen: Schema.Boolean,
  search: Schema.String,
  skipSeen: Schema.Boolean,
  loading: Schema.Boolean,
  navigationId: Schema.Number,
  error: Schema.NullOr(Schema.String),
  repliesStatus: Schema.Literals(['loading', 'ready', 'error']),
  player: Player.Model,
  creator: Creator.Model,
  dashboard: Dashboard.Model,
})

export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  MenuToggled: {},
  SearchChanged: { value: Schema.String },
  SkipSeenChanged: { value: Schema.Boolean },
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

type Services = Player.PlayerClient | Creator.CreatorService | Dashboard.DashboardService

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

const Leave = Command.define('Navigation.Leave', {
  args: { href: Schema.String },
  messages: [Message.NavigationCompleted],
  execute: ({ href }) => Navigation.load(href).pipe(Effect.as(Message.NavigationCompleted())),
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
    MenuToggled: () => ({ model: { ...model, menuOpen: !model.menuOpen } }),
    SearchChanged: ({ value }) => ({ model: { ...model, search: value } }),
    SkipSeenChanged: ({ value }) => ({ model: { ...model, skipSeen: value } }),
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
        model: { ...next.model, player: model.player, skipSeen: model.skipSeen, navigationId },
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
      search: '',
      skipSeen: false,
      loading: false,
      navigationId: 0,
      error: null,
      repliesStatus: flags.tweet ? 'loading' : 'ready',
      player: Player.initialModel,
      creator: creator.model,
      dashboard: flags.dashboard
        ? { ...dashboard.model, ...flags.dashboard, phase: 'ready' }
        : dashboard.model,
    },
    commands: [
      ...(flags.tweet
        ? [LoadReplies({ slug: flags.tweet.post.slug }), MarkSeen({ slug: flags.tweet.post.slug })]
        : []),
      ...(creatorKind
        ? Command.mapMessages(creator.commands ?? [], (message) =>
            Message.GotCreatorMessage({ message }),
          )
        : []),
      ...(section && flags.principal && !flags.dashboard
        ? Command.mapMessages(dashboard.commands ?? [], (message) =>
            Message.GotDashboardMessage({ message }),
          )
        : []),
    ],
  }
}

const nav = [
  ['/', 'Home'],
  ['/mixes', 'Mixes'],
  ['/shows', 'Shows'],
  ['/editorial', 'Editorial'],
  ['/tweets', 'Tweets'],
  ['/labels', 'Labels'],
  ['/tags', 'Tags'],
] as const

const link = (h: HtmlBuilder<Message>, href: string, label: string, className = '') =>
  h.a([h.Href(href), h.Class(className)], [label])

const paragraphs = (h: HtmlBuilder<Message>, content: string) =>
  content.split(/\n\s*\n/).map((text) => h.p([h.Class('content-paragraph')], [text]))

const cards = (model: Model, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class('cards')],
    model.flags.items.map((item) =>
      h.article(
        [h.Class('card'), h.Key(item.id)],
        [
          item.imageUrl ? h.img([h.Src(item.imageUrl), h.Alt(''), h.Loading('lazy')]) : h.empty,
          h.div(
            [h.Class('card-copy')],
            [
              link(h, item.href, item.title, 'card-title'),
              item.meta ? h.small([], [item.meta]) : h.empty,
              item.description ? h.p([], [item.description]) : h.empty,
              item.audioUrl
                ? h.button(
                    [
                      h.OnClick(
                        Message.GotPlayerMessage({
                          message: Player.Message.PlayTrack({
                            track: {
                              id: item.id,
                              title: item.title,
                              url: item.audioUrl,
                              slug: item.slug,
                              thumbnailUrl: item.imageUrl,
                              type: 'mix',
                            },
                          }),
                        }),
                      ),
                    ],
                    ['Play'],
                  )
                : h.empty,
            ],
          ),
        ],
      ),
    ),
  )

const auth = (h: HtmlBuilder<Message>, action: string) =>
  h.section(
    [h.Class('auth-page')],
    [
      h.form(
        [h.Class('panel'), h.Method('post'), h.Action(`/auth/${action}`)],
        [
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
          h.label(
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
        ],
      ),
    ],
  )

const tweetView = (model: Model, h: HtmlBuilder<Message>) => {
  const screen = model.flags.tweet

  if (!screen) return h.p([], [model.flags.failure ?? 'Tweet not found.'])
  const neighbours = model.flags.neighbours
  const older = model.skipSeen ? neighbours?.olderUnread : neighbours?.older

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
        ...paragraphs(h, post.content ?? ''),
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
      h.nav(
        [h.Class('tweet-wayfinder'), h.AriaLabel('Tweet timeline')],
        [
          link(h, '/tweets', 'Tweets'),
          ...(neighbours?.timeline ?? []).map((month) =>
            link(h, `/tweet/${month.newestSlug}`, `${month.month} (${month.unread} unread)`),
          ),
        ],
      ),
      postView(screen.post),
      screen.quote ? h.blockquote([], [postView(screen.quote)]) : h.empty,
      h.nav(
        [h.AriaLabel('Tweet navigation')],
        [
          neighbours?.newer ? link(h, `/tweet/${neighbours.newer}`, 'Newer') : h.empty,
          older ? link(h, `/tweet/${older}`, 'Older') : h.empty,
          h.label(
            [],
            [
              h.input([
                h.Type('checkbox'),
                h.Checked(model.skipSeen),
                h.OnClick(Message.SkipSeenChanged({ value: !model.skipSeen })),
              ]),
              'Skip seen',
            ],
          ),
        ],
      ),
      h.h2([], ['Replies']),
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
  const content = Route.match(model.route, {
    Home: () =>
      h.section(
        [h.Class('page')],
        [
          h.h1([], ['goosebumps.fm']),
          h.p([], ['Independent music, mixes and stories.']),
          cards(model, h),
        ],
      ),
    Listing: () =>
      h.section(
        [h.Class('page')],
        [
          h.h1([], [model.flags.title]),
          model.flags.failure ? h.p([h.Role('alert')], [model.flags.failure]) : h.empty,
          cards(model, h),
        ],
      ),
    Detail: ({ kind }) =>
      kind === 'tweets'
        ? tweetView(model, h)
        : h.article(
            [h.Class('page detail')],
            [
              h.h1([], [model.flags.title]),
              cards(model, h),
              ...paragraphs(h, model.flags.items[0]?.content ?? ''),
            ],
          ),
    Auth: ({ action }) => auth(h, action),
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
        : auth(h, 'sign-in'),
    Static: ({ page }) =>
      h.article(
        [h.Class('page prose')],
        [
          h.h1([], [model.flags.title]),
          ...(staticPages.get(page)?.paragraphs ?? []).map((text) =>
            h.p([h.Class('content-paragraph')], [text]),
          ),
          page === 'changelog'
            ? link(
                h,
                'https://github.com/guidefari/gbfm/blob/prod/CHANGELOG.md',
                'Read the complete release history',
              )
            : h.empty,
        ],
      ),
    NotFound: () =>
      h.section([h.Class('page')], [h.h1([], ['Page not found']), link(h, '/', 'Return home')]),
  })

  return {
    title: `${model.flags.title} | goosebumps.fm`,
    lang: 'en',
    canonical: `https://goosebumps.fm${new URL(model.flags.url).pathname}`,
    ogUrl: `https://goosebumps.fm${new URL(model.flags.url).pathname}`,
    body: h.div(
      [h.Class('site dark')],
      [
        h.header(
          [h.Class('topbar')],
          [
            link(h, '/', 'goosebumps.fm', 'brand'),
            h.button(
              [
                h.OnClick(Message.MenuToggled()),
                h.AriaLabel('Toggle navigation'),
                h.Class('menu-button'),
              ],
              ['Menu'],
            ),
            h.nav(
              [h.Class(model.menuOpen ? 'nav open' : 'nav')],
              nav.map(([href, label]) => link(h, href, label)),
            ),
            link(
              h,
              model.flags.principal ? '/dashboard' : '/auth/sign-in',
              model.flags.principal?.name ?? 'Sign in',
            ),
          ],
        ),
        model.loading
          ? h.div([h.Role('progressbar'), h.AriaLabel('Loading page')], ['Loading…'])
          : h.empty,
        model.error ? h.p([h.Role('alert')], [model.error]) : h.empty,
        h.main([], [content]),
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
)

export const subscriptions = Subscription.lift(Player.subscriptions)<Model, Message>({
  toChildModel: (model) => model.player,
  toParentMessage: (message) => Message.GotPlayerMessage({ message }),
})
