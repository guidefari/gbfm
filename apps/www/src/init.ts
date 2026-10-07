import * as Dialog from '@foldkit/ui/dialog'
import * as Popover from '@foldkit/ui/popover'
import { canCreatePosts, isRole } from '@gbfm/core/roles'
import { Match } from 'effect'
import { Command, type Runtime } from 'foldkit'

import { StartClient } from './command'
import { Message } from './message'
import type { Flags, Model } from './model'
import { seedCache } from './page-cache'
import * as Creator from './page/creator'
import * as Dashboard from './page/dashboard'
import * as TweetReader from './page/tweet/reader'
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
      mobileMenu: Dialog.init({ id: 'mobile-menu', isAnimated: true }),
      menuDrag: null,
      menuOffset: 0,
      accountMenu: Popover.init({ id: 'account-menu', contentFocus: true }),
      search: Search.initialModel,
      skipSeen: flags.skipSeen,
      loading: false,
      pendingPath: null,
      pageCache: seedCache(flags),
      interactive: false,
      navigationId: 0,
      tweetReader: TweetReader.init(flags.principal?.id ?? 'anonymous'),
      error: null,
      repliesStatus: flags.tweet ? 'loading' : 'ready',
      player: Player.initialModel,
      publicAction: PublicActions.init(flags.publicAction),
      creator: creator.model,
      dashboard: preparedDashboard.model,
    },
    commands: [
      StartClient(),
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
