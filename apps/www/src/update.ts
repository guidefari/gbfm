import * as Dialog from '@foldkit/ui/dialog'
import * as Popover from '@foldkit/ui/popover'
import { HashMap, Match, Option, Result } from 'effect'
import { AsyncData, Command, Update } from 'foldkit'
import { UrlRequest } from 'foldkit/navigation'
import { toString as urlToString } from 'foldkit/url'

import {
  Leave,
  LoadPage,
  Navigate,
  PauseCreatorUpload,
  PrefetchPage,
  SaveReadMode,
  SetResolvedUrl,
} from './command'
import { init, type Services } from './init'
import { Message } from './message'
import type { Flags, Model } from './model'
import { isCacheable, pageKey, samePage, settlePage } from './page-cache'
import * as Creator from './page/creator'
import * as Dashboard from './page/dashboard'
import * as Player from './player'
import * as PublicActions from './public-actions'
import { isServerPath, Route } from './route'
import * as Search from './search'
import { dragOffset, shouldDismiss, startDrag } from './sheet-drag'

const mobileMenuFold = {
  read: (model: Model) => Option.some(model.mobileMenu),
  write: (model: Model, mobileMenu: Dialog.Model): Model => ({ ...model, mobileMenu }),
  toParentMessage: (message: Dialog.Message) => Message.GotMobileMenuMessage({ message }),
  foldOutMessage: Dialog.OutMessage.match<Update.Step<Model, Message>>({
    Opened: () => (model) => ({ model: { ...model, menuDrag: null, menuOffset: 0 } }),
    Closed: () => (model) => ({ model: { ...model, menuDrag: null } }),
  }),
}

const updateMobileMenu = Update.foldChild({ ...mobileMenuFold, update: Dialog.update })

const openMobileMenu = Update.foldChildStep({ ...mobileMenuFold, update: Dialog.open })

const closeMobileMenu = Update.foldChildStep({ ...mobileMenuFold, update: Dialog.close })

const accountMenuFold = {
  read: (model: Model) => Option.some(model.accountMenu),
  write: (model: Model, accountMenu: Popover.Model): Model => ({ ...model, accountMenu }),
  toParentMessage: (message: Popover.Message) => Message.GotAccountMenuMessage({ message }),
  foldOutMessage: Popover.OutMessage.match<Update.Step<Model, Message>>({
    Opened: () => (model) => ({ model }),
    Closed: () => (model) => ({ model }),
  }),
}

const updateAccountMenu = Update.foldChild({ ...accountMenuFold, update: Popover.update })

const closeAccountMenu = Update.foldChildStep({ ...accountMenuFold, update: Popover.close })

const closeSearch = (model: Model): Update.Return<Model, Message> => {
  const child = Search.close(model.search)

  return {
    model: { ...model, search: child.model },
    commands: Command.mapMessages(child.commands ?? [], (message) =>
      Message.GotSearchMessage({ message }),
    ),
  }
}

const closeOverlays = Update.combine([closeMobileMenu, closeAccountMenu, closeSearch])

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
      mobileMenu: model.mobileMenu,
      menuDrag: model.menuDrag,
      menuOffset: model.menuOffset,
      accountMenu: model.accountMenu,
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
    AccountMenuClosed: () => closeAccountMenu(model),
    GotAccountMenuMessage: ({ message }) => updateAccountMenu(model, message),
    MenuToggled: () => (model.mobileMenu.isOpen ? closeMobileMenu(model) : openMobileMenu(model)),
    GotMobileMenuMessage: ({ message }) => updateMobileMenu(model, message),
    MenuDragStarted: ({ pointerId, clientY }) =>
      !model.mobileMenu.isOpen ||
      model.mobileMenu.animation.transitionState !== 'Idle' ||
      model.menuDrag
        ? { model }
        : { model: { ...model, menuDrag: startDrag(pointerId, clientY, model.menuOffset) } },
    MenuDragMoved: ({ pointerId, clientY }) =>
      model.menuDrag?.pointerId === pointerId
        ? { model: { ...model, menuOffset: dragOffset(model.menuDrag, clientY) } }
        : { model },
    MenuDragReleased: ({ pointerId, clientY, viewportHeight }) => {
      if (model.menuDrag?.pointerId !== pointerId) return { model }
      const offset = dragOffset(model.menuDrag, clientY)
      const released = { ...model, menuDrag: null, menuOffset: offset }

      return shouldDismiss(offset, viewportHeight)
        ? closeMobileMenu(released)
        : { model: { ...released, menuOffset: 0 } }
    },
    MenuDragCancelled: () =>
      model.menuDrag ? { model: { ...model, menuDrag: null, menuOffset: 0 } } : { model },
    GotSearchMessage: ({ message }) => {
      const menu = Update.combine(model, [closeMobileMenu, closeAccountMenu])
      const child = Search.update(model.search, message)

      return {
        model: { ...menu.model, search: child.model },
        commands: [
          ...(menu.commands ?? []),
          ...Command.mapMessages(child.commands ?? [], (message) =>
            Message.GotSearchMessage({ message }),
          ),
        ],
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
        Internal: ({ url }) => {
          const menu = closeOverlays(model)

          return {
            model: menu.model,
            commands: [
              ...(menu.commands ?? []),
              isServerPath(url.pathname)
                ? Leave({ href: urlToString(url) })
                : Navigate({ href: urlToString(url) }),
            ],
          }
        },
        External: ({ href }) => {
          const menu = closeOverlays(model)

          return { model: menu.model, commands: [...(menu.commands ?? []), Leave({ href })] }
        },
      }),
    ChangedUrl: ({ url }) => {
      const menu = closeOverlays(model)
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

      const player = Player.closeOverlays(model.player)

      const leaving = {
        ...menu.model,
        pageCache,
        navigationId,
        player: player.model,
      }

      const commands = [
        ...(menu.commands ?? []),
        ...Command.mapMessages(player.commands ?? [], (message) =>
          Message.GotPlayerMessage({ message }),
        ),
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
