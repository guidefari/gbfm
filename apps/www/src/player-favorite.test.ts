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
    Player.Favorite.Message.Loaded({ generation: model.player.favorite.generation, state }),
  ).model
}

const changed = (href: string) => Message.ChangedUrl({ url: Option.getOrThrow(fromString(href)) })

const commandNames = (result: { commands?: ReadonlyArray<{ name: string }> }) =>
  (result.commands ?? []).map(({ name }) => name)

const savePlayerFavorite = (model: Model, active: boolean) => {
  const saving = favorite(model, Player.Favorite.Message.Toggled()).model

  expect(saving.player.favorite.saving).toBe(true)

  return favorite(
    saving,
    Player.Favorite.Message.Saved({
      generation: saving.player.favorite.generation,
      audioId: 'mix-a',
      active,
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

    const signedOut = send(
      otherAccount.model,
      Message.LoadedPage({
        flags: page('/about', null),
        key: '/about',
        navigationId: otherAccount.model.navigationId,
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
