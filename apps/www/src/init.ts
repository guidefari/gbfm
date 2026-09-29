import { canCreatePosts, isRole } from '@gbfm/core/roles'
import { Match } from 'effect'
import { Command, type Runtime } from 'foldkit'

import { LoadReplies, MarkSeen, PrefetchPage, StartClient } from './command'
import * as Creator from './creator'
import * as Dashboard from './dashboard'
import { Message } from './message'
import type { Flags, Model } from './model'
import { seedCache } from './page-cache'
import * as Player from './player'
import * as PublicActions from './public-actions'
import { parseRoute } from './route'
import * as Search from './search'
import type { SpotifyConnection } from './spotify/connection'

export type Services =
  | Player.PlayerClient
  | Creator.CreatorService
  | Creator.CreatorUpload
  | Dashboard.DashboardService
  | Dashboard.SessionService
  | SpotifyConnection

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
