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
})
