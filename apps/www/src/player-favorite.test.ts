import type { QueueTrackType } from '@gbfm/player'
import { Option } from 'effect'
import { fromString } from 'foldkit/url'
import { describe, expect, it } from 'vitest'

import { init } from './init'
import { Message } from './message'
import type { Flags, Model, Principal } from './model'
import * as Player from './player'
import * as PublicActions from './public-actions'
import { update } from './update'

const listener: Principal = { id: 'user-1', name: 'Listener', username: null, role: 'user' }

const track: QueueTrackType = {
  id: 'mix-a',
  title: 'Local Frequencies',
  slug: 'local-frequencies',
  url: 'https://cdn.test/mix-a.mp3',
  thumbnailUrl: null,
  type: 'mix',
}

const page = (
  path: string,
  principal: Principal | null,
  publicAction: Flags['publicAction'] = null,
): Flags => ({
  url: `https://gbfm.co.za${path}`,
  status: 200,
  principal,
  items: [],
  title: path,
  description: '',
  requestId: path,
  renderedAt: 0,
  skipSeen: false,
  tweet: null,
  neighbours: null,
  dashboard: null,
  profile: null,
  shows: null,
  changelog: null,
  publicAction,
  metadata: null,
  failure: null,
})

const mixPage = (state: 'active' | 'inactive', principal: Principal | null = listener) =>
  page('/mixes/local-frequencies', principal, {
    target: { id: 'mix-a', kind: 'audio' },
    path: '/mixes/local-frequencies',
    state,
  })

const send = (model: Model, message: Message) => update(model, message)

const player = (model: Model, message: Player.Message) =>
  send(model, Message.GotPlayerMessage({ message }))

const favorite = (model: Model, message: Player.Favorite.Message) =>
  player(model, Player.Message.GotFavoriteMessage({ message }))

const playing = (flags: Flags) => {
  const started = send(init(flags).model, Message.ClientStarted()).model

  const snapshot = {
    ...started.player.snapshot,
    queue: { tracks: [track], currentIndex: 0, current: track },
  }

  return player(started, Player.Message.SnapshotChanged({ snapshot }))
}

const settled = (flags: Flags, state: 'active' | 'inactive') => {
  const model = playing(flags).model

  return favorite(
    model,
    Player.Favorite.Message.Loaded({
      generation: model.player.favorite.generation,
      state,
      principalId: flags.principal?.id ?? null,
      principalKnown: true,
    }),
  ).model
}

const changed = (href: string) => Message.ChangedUrl({ url: Option.getOrThrow(fromString(href)) })

const commandNames = (result: { commands?: ReadonlyArray<{ name: string }> }) =>
  (result.commands ?? []).map(({ name }) => name)

const savePlayerFavorite = (model: Model, active: boolean) => {
  const saving = favorite(model, Player.Favorite.Message.Toggled()).model

  expect(saving.player.favorite.saving).toBe(true)
  const principalId = saving.player.favorite.principalId

  if (!principalId) throw new Error('Expected an authenticated favorite save')

  return favorite(
    saving,
    Player.Favorite.Message.Saved({
      generation: saving.player.favorite.generation,
      audioId: 'mix-a',
      active,
      principalId,
    }),
  ).model
}

const loadMixPage = (model: Model, flags: Flags = mixPage('inactive')) =>
  send(
    model,
    Message.LoadedPage({
      flags,
      key: '/mixes/local-frequencies',
      navigationId: model.navigationId,
    }),
  )

const changeTrack = (model: Model, current: QueueTrackType) =>
  player(
    model,
    Player.Message.SnapshotChanged({
      snapshot: {
        ...model.player.snapshot,
        queue: { tracks: [current], currentIndex: 0, current },
      },
    }),
  ).model

describe('player favorite integration', () => {
  it('preserves an API-recovered account and its acknowledged save when page identity was unknown', () => {
    const loading = playing(page('/about', null)).model

    const recovered = favorite(
      loading,
      Player.Favorite.Message.Loaded({
        generation: loading.player.favorite.generation,
        state: 'inactive',
        principalId: listener.id,
        principalKnown: true,
      }),
    ).model

    expect(recovered.player.favorite.principalId).toBe(listener.id)
    const navigation = send(recovered, changed('https://gbfm.co.za/mixes/local-frequencies')).model

    expect(navigation.player.favorite.principalId).toBe(listener.id)
    const saved = savePlayerFavorite(navigation, true)
    const loaded = loadMixPage(saved).model

    expect(loaded.publicAction.document?.state).toBe('active')
    expect(loaded.player.favorite).toMatchObject({ principalId: listener.id, status: 'active' })

    const later = send(loaded, changed('https://gbfm.co.za/mixes/local-frequencies')).model
    const externalRemoval = loadMixPage(later).model

    expect(externalRemoval.publicAction.document?.state).toBe('inactive')
    expect(externalRemoval.player.favorite).toMatchObject({
      principalId: listener.id,
      status: 'inactive',
    })
  })

  it('rejects account A page acknowledgements after account B loads the same audio', () => {
    const inactive = settled(mixPage('inactive'), 'inactive')

    const pending = send(
      inactive,
      Message.GotPublicActionMessage({ message: PublicActions.Message.Toggle() }),
    ).model

    const leaving = send(pending, changed('https://gbfm.co.za/mixes/local-frequencies')).model
    const switched = loadMixPage(leaving, mixPage('inactive', { ...listener, id: 'user-2' })).model

    const late = send(
      switched,
      Message.GotPublicActionMessage({
        message: PublicActions.Message.Saved({
          target: { id: 'mix-a', kind: 'audio' },
          active: true,
          principalId: listener.id,
          requestId: pending.publicAction.requestId,
        }),
      }),
    ).model

    expect(late.publicAction.document?.state).toBe('inactive')
    expect(late.player.favorite).toMatchObject({ principalId: 'user-2', status: 'inactive' })
    expect(late.navigationFavoriteChanges).toEqual([])

    const cached = send(late, changed('https://gbfm.co.za/mixes/local-frequencies')).model
    const restarted = send(cached, Message.ClientStarted()).model

    expect(restarted.player.favorite).toMatchObject({ principalId: 'user-2', status: 'inactive' })
    expect(restarted.publicAction).toMatchObject({
      busy: false,
      document: { state: 'inactive' },
    })
  })

  it.each(['Saved', 'Failed'])(
    'does not let an old page %s settle a different account request or a later same-account request',
    (result) => {
      const inactive = settled(mixPage('inactive'), 'inactive')

      const pendingA = send(
        inactive,
        Message.GotPublicActionMessage({ message: PublicActions.Message.Toggle() }),
      ).model

      const leavingA = send(pendingA, changed('https://gbfm.co.za/mixes/local-frequencies')).model

      const accountB = loadMixPage(
        leavingA,
        mixPage('inactive', { ...listener, id: 'user-2' }),
      ).model

      const pendingB = send(
        accountB,
        Message.GotPublicActionMessage({ message: PublicActions.Message.Toggle() }),
      ).model

      const oldResult =
        result === 'Saved'
          ? PublicActions.Message.Saved({
              target: { id: 'mix-a', kind: 'audio' },
              active: true,
              principalId: listener.id,
              requestId: pendingA.publicAction.requestId,
            })
          : PublicActions.Message.Failed({
              target: { id: 'mix-a', kind: 'audio' },
              unauthorized: true,
              principalId: listener.id,
              requestId: pendingA.publicAction.requestId,
            })

      const lateA = send(pendingB, Message.GotPublicActionMessage({ message: oldResult })).model

      expect(lateA.publicAction).toEqual(pendingB.publicAction)
      expect(lateA.player.favorite).toEqual(pendingB.player.favorite)
      expect(lateA.navigationFavoriteChanges).toEqual([])

      const savedB = send(
        lateA,
        Message.GotPublicActionMessage({
          message: PublicActions.Message.Saved({
            target: { id: 'mix-a', kind: 'audio' },
            active: true,
            principalId: 'user-2',
            requestId: pendingB.publicAction.requestId,
          }),
        }),
      ).model

      expect(savedB.publicAction).toMatchObject({ busy: false, document: { state: 'active' } })
      expect(savedB.player.favorite).toMatchObject({ principalId: 'user-2', status: 'active' })
      expect(savedB.navigationFavoriteChanges).toEqual([
        { principalId: 'user-2', audioId: 'mix-a', active: true },
      ])

      const leavingB = send(savedB, changed('https://gbfm.co.za/mixes/local-frequencies')).model

      const external = loadMixPage(
        leavingB,
        mixPage('inactive', { ...listener, id: 'user-2' }),
      ).model

      expect(external.publicAction.document?.state).toBe('inactive')
      expect(external.player.favorite.status).toBe('inactive')

      const returningA = send(external, changed('https://gbfm.co.za/mixes/local-frequencies')).model
      const accountA = loadMixPage(returningA).model

      const newA = send(
        accountA,
        Message.GotPublicActionMessage({ message: PublicActions.Message.Toggle() }),
      ).model

      const obsolete = send(newA, Message.GotPublicActionMessage({ message: oldResult })).model

      expect(newA.publicAction.busy).toBe(true)
      expect(obsolete.publicAction).toEqual(newA.publicAction)
      expect(obsolete.player.favorite).toEqual(newA.player.favorite)
      expect(obsolete.navigationFavoriteChanges).toEqual([])
    },
  )

  it('retains independently confirmed identity across unknown pages but honors confirmed sign-out', () => {
    const inactive = settled(mixPage('inactive'), 'inactive')
    const leaving = send(inactive, changed('https://gbfm.co.za/about')).model

    const unknown = send(
      leaving,
      Message.LoadedPage({
        flags: { ...page('/about', null), principalKnown: false },
        key: '/about',
        navigationId: leaving.navigationId,
      }),
    ).model

    expect(unknown.player.favorite).toMatchObject({ principalId: listener.id, status: 'inactive' })

    const next = send(unknown, changed('https://gbfm.co.za/about')).model

    const signedOut = send(
      next,
      Message.LoadedPage({
        flags: { ...page('/about', null), principalKnown: true },
        key: '/about',
        navigationId: next.navigationId,
      }),
    ).model

    const obsolete = favorite(
      signedOut,
      Player.Favorite.Message.Loaded({
        generation: inactive.player.favorite.generation,
        state: 'active',
        principalId: listener.id,
        principalKnown: true,
      }),
    ).model

    expect(signedOut.player.favorite).toMatchObject({ principalId: null, status: 'loading' })
    expect(obsolete.player.favorite).toEqual(signedOut.player.favorite)
  })

  it('ignores obsolete player loads and save failures while the next account is loading', () => {
    const inactive = settled(mixPage('inactive'), 'inactive')
    const saving = favorite(inactive, Player.Favorite.Message.Toggled()).model
    const leaving = send(saving, changed('https://gbfm.co.za/about')).model

    const switched = send(
      leaving,
      Message.LoadedPage({
        flags: page('/about', { ...listener, id: 'user-2' }),
        key: '/about',
        navigationId: leaving.navigationId,
      }),
    ).model

    expect(switched.player.favorite).toMatchObject({
      principalId: 'user-2',
      status: 'loading',
      saving: false,
    })

    const oldLoad = favorite(
      switched,
      Player.Favorite.Message.Loaded({
        generation: saving.player.favorite.generation,
        state: 'active',
        principalId: listener.id,
        principalKnown: true,
      }),
    ).model

    const oldFailure = favorite(
      oldLoad,
      Player.Favorite.Message.SaveFailed({
        generation: saving.player.favorite.generation,
        principalId: listener.id,
        unauthorized: true,
      }),
    ).model

    expect(oldFailure.player.favorite).toEqual(switched.player.favorite)
    expect(oldFailure.navigationFavoriteChanges).toEqual([])

    const current = favorite(
      oldFailure,
      Player.Favorite.Message.Loaded({
        generation: switched.player.favorite.generation,
        state: 'inactive',
        principalId: 'user-2',
        principalKnown: true,
      }),
    ).model

    expect(current.player.favorite).toMatchObject({
      principalId: 'user-2',
      status: 'inactive',
      saving: false,
    })
  })

  it('invalidates an in-flight page save when the player API independently confirms another account', () => {
    const initial = playing(mixPage('inactive')).model

    const pending = send(
      initial,
      Message.GotPublicActionMessage({ message: PublicActions.Message.Toggle() }),
    ).model

    const confirmed = favorite(
      pending,
      Player.Favorite.Message.Loaded({
        generation: pending.player.favorite.generation,
        state: 'inactive',
        principalId: 'user-2',
        principalKnown: true,
      }),
    ).model

    const late = send(
      confirmed,
      Message.GotPublicActionMessage({
        message: PublicActions.Message.Failed({
          target: { id: 'mix-a', kind: 'audio' },
          unauthorized: true,
          principalId: listener.id,
          requestId: pending.publicAction.requestId,
        }),
      }),
    ).model

    expect(confirmed.publicAction).toMatchObject({
      busy: false,
      document: { state: 'unavailable' },
    })
    expect(late.publicAction).toEqual(confirmed.publicAction)
    expect(late.player.favorite).toMatchObject({ principalId: 'user-2', status: 'inactive' })
    expect(late.navigationFavoriteChanges).toEqual([])

    const cached = send(late, changed('https://gbfm.co.za/mixes/local-frequencies')).model
    const restarted = send(cached, Message.ClientStarted()).model

    expect(restarted.player.favorite).toMatchObject({ principalId: 'user-2', status: 'inactive' })
    expect(restarted.publicAction).toMatchObject({
      busy: false,
      document: { state: 'unavailable' },
    })
  })

  it('invalidates an unknown-account load when a newer page confirms signed-out identity', () => {
    const unknown = playing(page('/about', null)).model
    const navigation = send(unknown, changed('https://gbfm.co.za/about')).model

    const signedOut = send(
      navigation,
      Message.LoadedPage({
        flags: { ...page('/about', null), principalKnown: true },
        key: '/about',
        navigationId: navigation.navigationId,
      }),
    ).model

    const obsolete = favorite(
      signedOut,
      Player.Favorite.Message.Loaded({
        generation: unknown.player.favorite.generation,
        state: 'active',
        principalId: listener.id,
        principalKnown: true,
      }),
    ).model

    expect(signedOut.player.favorite).toMatchObject({
      principalId: null,
      principalKnown: true,
      status: 'loading',
    })
    expect(signedOut.player.favorite.generation).toBeGreaterThan(unknown.player.favorite.generation)
    expect(obsolete.player.favorite).toEqual(signedOut.player.favorite)
  })

  it('honors a current page request authorization failure and invalidates older player reads', () => {
    const initial = playing(mixPage('inactive')).model

    const pending = send(
      initial,
      Message.GotPublicActionMessage({ message: PublicActions.Message.Toggle() }),
    ).model

    const failed = send(
      pending,
      Message.GotPublicActionMessage({
        message: PublicActions.Message.Failed({
          target: { id: 'mix-a', kind: 'audio' },
          unauthorized: true,
          principalId: listener.id,
          requestId: pending.publicAction.requestId,
        }),
      }),
    ).model

    const obsolete = favorite(
      failed,
      Player.Favorite.Message.Loaded({
        generation: initial.player.favorite.generation,
        state: 'active',
        principalId: listener.id,
        principalKnown: true,
      }),
    ).model

    expect(failed.publicAction).toMatchObject({
      principalId: null,
      busy: false,
      document: { state: 'anonymous' },
    })
    expect(failed.player.favorite).toMatchObject({
      principalId: null,
      principalKnown: true,
      status: 'loading',
    })
    expect(obsolete.player.favorite).toEqual(failed.player.favorite)
    expect(obsolete.navigationFavoriteChanges).toEqual([])
  })

  it.each(['previous account', 'signed-out'])(
    'does not adopt an older %s page identity after the player confirms another account',
    (identity) => {
      const initial = playing(page('/about', null)).model
      const navigation = send(initial, changed('https://gbfm.co.za/mixes/local-frequencies')).model

      const confirmed = favorite(
        navigation,
        Player.Favorite.Message.Loaded({
          generation: navigation.player.favorite.generation,
          state: 'inactive',
          principalId: 'user-2',
          principalKnown: true,
        }),
      ).model

      const saved = savePlayerFavorite(confirmed, true)

      const oldFlags =
        identity === 'previous account'
          ? mixPage('inactive')
          : {
              ...page('/mixes/local-frequencies', null, {
                target: { id: 'mix-a', kind: 'audio' },
                path: '/mixes/local-frequencies',
                state: 'anonymous',
              }),
              principalKnown: true,
            }

      const stale = loadMixPage(saved, oldFlags).model

      expect(stale.publicAction).toMatchObject({ busy: false, document: { state: 'unavailable' } })
      expect(stale.player.favorite).toMatchObject({ principalId: 'user-2', status: 'active' })

      const later = send(stale, changed('https://gbfm.co.za/mixes/local-frequencies')).model

      const externalRemoval = loadMixPage(
        later,
        mixPage('inactive', { ...listener, id: 'user-2' }),
      ).model

      expect(externalRemoval.publicAction.document?.state).toBe('inactive')
      expect(externalRemoval.player.favorite).toMatchObject({
        principalId: 'user-2',
        status: 'inactive',
      })
    },
  )

  it('loads the queued track favorite regardless of the browsed page', () => {
    const result = playing(page('/about', listener))

    expect(result.model.player.favorite).toMatchObject({
      status: 'loading',
      principalId: 'user-1',
      track: { audioId: 'mix-a', slug: 'local-frequencies' },
    })
    expect(commandNames(result)).toContain('PlayerFavorite.Load')
  })

  it('keeps favorite state across navigation and reloads it for a different account', () => {
    const active = settled(page('/about', listener), 'active')
    const leaving = send(active, changed('https://gbfm.co.za/shows'))

    const shows = send(
      leaving.model,
      Message.LoadedPage({
        flags: page('/shows', listener),
        key: '/shows',
        navigationId: leaving.model.navigationId,
      }),
    )

    expect(shows.model.player.favorite.status).toBe('active')

    const otherAccount = send(
      shows.model,
      Message.LoadedPage({
        flags: page('/about', { ...listener, id: 'user-2' }),
        key: '/about',
        navigationId: shows.model.navigationId,
      }),
    )

    expect(otherAccount.model.player.favorite).toMatchObject({
      status: 'loading',
      principalId: 'user-2',
    })
    expect(commandNames(otherAccount)).toContain('PlayerFavorite.Load')

    const signingOut = send(otherAccount.model, changed('https://gbfm.co.za/about')).model

    const signedOut = send(
      signingOut,
      Message.LoadedPage({
        flags: { ...page('/about', null), principalKnown: true },
        key: '/about',
        navigationId: signingOut.navigationId,
      }),
    )

    expect(signedOut.model.player.favorite).toMatchObject({ status: 'loading', principalId: null })
  })

  it('applies a page favorite save to the player heart for the same audio', () => {
    const inactive = settled(mixPage('inactive'), 'inactive')

    const pending = send(
      inactive,
      Message.GotPublicActionMessage({ message: PublicActions.Message.Toggle() }),
    ).model

    const saved = send(
      pending,
      Message.GotPublicActionMessage({
        message: PublicActions.Message.Saved({
          target: { id: 'mix-a', kind: 'audio' },
          active: true,
          principalId: listener.id,
          requestId: pending.publicAction.requestId,
        }),
      }),
    ).model

    expect(saved.publicAction.document?.state).toBe('active')
    expect(saved.player.favorite.status).toBe('active')
  })

  it('applies an acknowledged player save to the page control, and only after acknowledgement', () => {
    const inactive = settled(mixPage('inactive'), 'inactive')
    const saving = favorite(inactive, Player.Favorite.Message.Toggled())

    expect(saving.model.publicAction.document?.state).toBe('inactive')
    expect(commandNames(saving)).toEqual(['PlayerFavorite.Save'])

    const saved = favorite(
      saving.model,
      Player.Favorite.Message.Saved({
        generation: saving.model.player.favorite.generation,
        audioId: 'mix-a',
        active: true,
        principalId: listener.id,
      }),
    ).model

    expect(saved.player.favorite.status).toBe('active')
    expect(saved.publicAction.document?.state).toBe('active')
  })

  it('does not restore stale cached page state over a newer player save', () => {
    const inactive = settled(mixPage('inactive'), 'inactive')
    const away = send(inactive, changed('https://gbfm.co.za/about')).model

    const about = send(
      away,
      Message.LoadedPage({
        flags: page('/about', listener),
        key: '/about',
        navigationId: away.navigationId,
      }),
    ).model

    const saving = favorite(about, Player.Favorite.Message.Toggled()).model

    const saved = favorite(
      saving,
      Player.Favorite.Message.Saved({
        generation: saving.player.favorite.generation,
        audioId: 'mix-a',
        active: true,
        principalId: listener.id,
      }),
    ).model

    const back = send(saved, changed('https://gbfm.co.za/mixes/local-frequencies')).model

    expect(back.publicAction.document?.state).toBe('active')
    expect(back.player.favorite.status).toBe('active')
  })

  it('adopts freshly loaded page state into the player heart', () => {
    const active = settled(page('/about', listener), 'active')
    const leaving = send(active, changed('https://gbfm.co.za/mixes/local-frequencies')).model

    const loaded = send(
      leaving,
      Message.LoadedPage({
        flags: mixPage('inactive'),
        key: '/mixes/local-frequencies',
        navigationId: leaving.navigationId,
      }),
    ).model

    expect(loaded.publicAction.document?.state).toBe('inactive')
    expect(loaded.player.favorite.status).toBe('inactive')
  })

  it('does not let a current-navigation page read undo an acknowledged player save', () => {
    const inactive = settled(page('/about', listener), 'inactive')
    const navigation = send(inactive, changed('https://gbfm.co.za/mixes/local-frequencies'))

    expect(commandNames(navigation)).toContain('Navigation.Load')

    const saving = favorite(navigation.model, Player.Favorite.Message.Toggled()).model

    const saved = favorite(
      saving,
      Player.Favorite.Message.Saved({
        generation: saving.player.favorite.generation,
        audioId: 'mix-a',
        active: true,
        principalId: listener.id,
      }),
    ).model

    expect(saved.player.favorite.status).toBe('active')

    const loaded = send(
      saved,
      Message.LoadedPage({
        flags: mixPage('inactive'),
        key: '/mixes/local-frequencies',
        navigationId: navigation.model.navigationId,
      }),
    ).model

    expect(loaded.publicAction.document?.state).toBe('active')
    expect(loaded.player.favorite.status).toBe('active')
  })

  it('adopts newer server state from a subsequent request, even when its flags match the cache', () => {
    const inactive = settled(page('/about', listener), 'inactive')
    const navigation = send(inactive, changed('https://gbfm.co.za/mixes/local-frequencies')).model
    const saved = savePlayerFavorite(navigation, true)
    const stale = loadMixPage(saved).model

    expect(stale.publicAction.document?.state).toBe('active')

    const revalidating = send(stale, changed('https://gbfm.co.za/mixes/local-frequencies'))

    expect(commandNames(revalidating)).toContain('Navigation.Load')
    expect(revalidating.model.publicAction.document?.state).toBe('active')

    const externalRemoval = loadMixPage(revalidating.model).model

    expect(externalRemoval.publicAction.document?.state).toBe('inactive')
    expect(externalRemoval.player.favorite.status).toBe('inactive')
  })

  it.each(['before returning', 'after returning'])(
    'protects the page when the player changes track and the stale read arrives %s',
    (arrival) => {
      const inactive = settled(page('/about', listener), 'inactive')
      const navigation = send(inactive, changed('https://gbfm.co.za/mixes/local-frequencies')).model
      const saved = savePlayerFavorite(navigation, true)
      const other = changeTrack(saved, { ...track, id: 'mix-b', slug: 'other-mix' })
      const returned = arrival === 'after returning' ? changeTrack(other, track) : other
      const loaded = loadMixPage(returned).model

      expect(loaded.publicAction.document?.state).toBe('active')

      expect(loaded.player.favorite).toMatchObject({
        track: { audioId: arrival === 'after returning' ? 'mix-a' : 'mix-b' },
        status: arrival === 'after returning' ? 'active' : 'loading',
      })

      const back = send(loaded, changed('https://gbfm.co.za/about')).model

      const about = send(
        back,
        Message.LoadedPage({
          flags: page('/about', listener),
          key: '/about',
          navigationId: back.navigationId,
        }),
      ).model

      const playingAgain = changeTrack(about, track)

      const settledAgain = favorite(
        playingAgain,
        Player.Favorite.Message.Loaded({
          generation: playingAgain.player.favorite.generation,
          state: 'active',
          principalId: listener.id,
          principalKnown: true,
        }),
      ).model

      const revisit = send(
        settledAgain,
        changed('https://gbfm.co.za/mixes/local-frequencies'),
      ).model

      expect(revisit.publicAction.document?.state).toBe('active')
      expect(loadMixPage(revisit).model.player.favorite.status).toBe('inactive')
    },
  )

  it('keeps an overtaken page save without replacing the favorite of a different playing track', () => {
    const inactive = settled(mixPage('inactive'), 'inactive')
    const other = changeTrack(inactive, { ...track, id: 'mix-b', slug: 'other-mix' })
    const navigation = send(other, changed('https://gbfm.co.za/mixes/local-frequencies')).model

    const pending = send(
      navigation,
      Message.GotPublicActionMessage({ message: PublicActions.Message.Toggle() }),
    ).model

    expect(pending.publicAction.busy).toBe(true)

    const saved = send(
      pending,
      Message.GotPublicActionMessage({
        message: PublicActions.Message.Saved({
          target: { id: 'mix-a', kind: 'audio' },
          active: true,
          principalId: listener.id,
          requestId: pending.publicAction.requestId,
        }),
      }),
    ).model

    const loaded = loadMixPage(saved).model

    expect(loaded.publicAction.document?.state).toBe('active')
    expect(loaded.player.favorite.track?.audioId).toBe('mix-b')
    expect(loaded.player.favorite.status).toBe('loading')
  })

  it('does not apply a save to another audio page in the same account', () => {
    const inactive = settled(page('/about', listener), 'inactive')
    const navigation = send(inactive, changed('https://gbfm.co.za/mixes/other-mix')).model
    const saved = savePlayerFavorite(navigation, true)

    const loaded = send(
      saved,
      Message.LoadedPage({
        flags: page('/mixes/other-mix', listener, {
          target: { id: 'mix-b', kind: 'audio' },
          path: '/mixes/other-mix',
          state: 'inactive',
        }),
        key: '/mixes/other-mix',
        navigationId: navigation.navigationId,
      }),
    ).model

    expect(loaded.publicAction.document?.state).toBe('inactive')
    expect(loaded.player.favorite.status).toBe('active')
  })

  it('adopts a different account without carrying over the previous account save', () => {
    const inactive = settled(page('/about', listener), 'inactive')
    const navigation = send(inactive, changed('https://gbfm.co.za/mixes/local-frequencies')).model
    const saved = savePlayerFavorite(navigation, true)
    const loaded = loadMixPage(saved, mixPage('inactive', { ...listener, id: 'user-2' })).model

    expect(loaded.publicAction.document?.state).toBe('inactive')
    expect(loaded.player.favorite.principalId).toBe('user-2')
    expect(loaded.player.favorite.status).toBe('inactive')
  })

  it('does not treat a failed player save as an acknowledged change', () => {
    const active = settled(page('/about', listener), 'active')
    const navigation = send(active, changed('https://gbfm.co.za/mixes/local-frequencies')).model
    const saving = favorite(navigation, Player.Favorite.Message.Toggled()).model

    expect(saving.player.favorite.status).toBe('active')

    const failed = favorite(
      saving,
      Player.Favorite.Message.SaveFailed({
        generation: saving.player.favorite.generation,
        unauthorized: false,
        principalId: listener.id,
      }),
    ).model

    const loaded = loadMixPage(failed).model

    expect(loaded.publicAction.document?.state).toBe('inactive')
    expect(loaded.player.favorite.status).toBe('inactive')
  })

  it('keeps the last acknowledged change when multiple player saves overtake a page read', () => {
    const inactive = settled(page('/about', listener), 'inactive')
    const navigation = send(inactive, changed('https://gbfm.co.za/mixes/local-frequencies')).model
    const added = savePlayerFavorite(navigation, true)
    const removed = savePlayerFavorite(added, false)
    const loaded = loadMixPage(removed, mixPage('active')).model

    expect(loaded.publicAction.document?.state).toBe('inactive')
    expect(loaded.player.favorite.status).toBe('inactive')
  })
})
