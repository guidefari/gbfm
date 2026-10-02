import { canCreatePosts } from '@gbfm/core/roles'
import { HashMap, Match, Option } from 'effect'
import { AsyncData } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'

import { Message } from './message'
import type { Model } from './model'
import * as Page from './page'
import * as Player from './player'
import * as PublicActions from './public-actions'
import { parseRoute, Route } from './route'
import * as Search from './search'
import { link } from './view/link'
import { pageSkeleton } from './view/skeletons'
import { stationNav } from './view/station-nav'

const nav = [
  ['/shows', 'Radio Shows'],
  ['/editorial', 'Editorial'],
  ['/tweets', 'Tweets'],
  ['/labels', 'Record Labels'],
] as const

const knownShows = (model: Model) =>
  model.flags.shows ??
  Array.from(HashMap.values(model.pageCache))
    .flatMap((entry) => Option.toArray(AsyncData.getData(entry)))
    .find((flags) => flags.shows !== null)?.shows ??
  null

const pendingShowSlug = (route: Route, shows: Page.Shows.ShowsDocument) =>
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
    play: (episode: Page.Shows.Episode) =>
      Message.GotPlayerMessage({ message: Player.Message.PlayTrack({ track: episode }) }),
    toggle: Message.GotPlayerMessage({ message: Player.Message.TogglePlayPause() }),
    currentId: model.player.snapshot.queue.current?.id ?? null,
    isPlaying: model.player.snapshot.transport.isPlaying,
  }

  const page =
    model.flags.status === 404
      ? h.section([h.Class('page')], [h.h1([], ['Page not found']), link(h, '/', 'Return home')])
      : model.flags.shows
        ? Page.Shows.view(
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
            Home: () => Page.Home.view(model, h),
            Listing: ({ kind }) =>
              kind === 'editorial'
                ? Page.EditorialList.view(
                    model.flags.items,
                    model.flags.renderedAt,
                    model.flags.failure ?? null,
                  )
                : Page.Content.listingView(model, h, kind),
            Detail: ({ kind }) =>
              kind === 'tweets'
                ? Page.Tweet.view(model, h)
                : kind === 'tags'
                  ? Page.Content.taggedPostsView(model, h)
                  : model.flags.profile
                    ? Page.Profile.view(model.flags.profile)
                    : Page.Content.detailView(model, h, kind),
            Auth: ({ action }) => Page.Auth.view(h, action, new URL(model.flags.url)),
            Composer: () =>
              h.submodel({
                slotId: 'creator',
                view: Page.Creator.view,
                model: model.creator,
                viewInputs: { role: model.flags.principal?.role ?? null },
                toParentMessage: (message) => Message.GotCreatorMessage({ message }),
              }),
            Dashboard: () =>
              model.flags.principal
                ? h.submodel({
                    slotId: 'dashboard',
                    view: Page.Dashboard.view,
                    model: model.dashboard,
                    viewInputs: { role: model.dashboard.principal.role, url: model.flags.url },
                    toParentMessage: (message) => Message.GotDashboardMessage({ message }),
                  })
                : Page.Auth.view(h, 'sign-in', new URL(model.flags.url)),
            Static: ({ page }) =>
              page === 'invite/charlie3000'
                ? Page.Invitation.view()
                : page === 'spotify-callback'
                  ? h.submodel({
                      slotId: 'dashboard',
                      view: Page.Dashboard.view,
                      model: model.dashboard,
                      viewInputs: { role: model.dashboard.principal.role, url: model.flags.url },
                      toParentMessage: (message) => Message.GotDashboardMessage({ message }),
                    })
                  : ['subscribe', 'unsubscribe'].includes(page)
                    ? Page.Newsletter.view(page, new URL(model.flags.url))
                    : Page.Static.view(h, page, model.flags.title, model.flags.changelog),
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
      ? Page.Shows.view(
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
