import { describe, expect, test } from 'vitest'

import {
  FavoriteRequestFailed,
  FavoriteSessionExpired,
  FavoriteTrackUnavailable,
  type FavoriteError,
} from '@/api/favorites'

import {
  FavoriteEvent,
  favoriteKey,
  FavoriteStatus,
  initialFavoriteState,
  reduceFavorite,
  statusFor,
  type FavoriteState,
} from './favoriteState'

const listenerTrack = favoriteKey('listener-1', 'track-a')

const listenerOtherTrack = favoriteKey('listener-1', 'track-b')

const otherListenerTrack = favoriteKey('listener-2', 'track-a')

const run = (
  events: ReadonlyArray<FavoriteEvent>,
  from: FavoriteState = initialFavoriteState(''),
) => events.reduce(reduceFavorite, from)

const loadingFor = (key: string) => run([FavoriteEvent.LoadStarted({ key })])

const readyFor = (key: string, favorite: boolean) =>
  run([FavoriteEvent.Loaded({ key, favorite })], loadingFor(key))

describe('favorite state', () => {
  test('shows loading until the server confirms the current state', () => {
    expect(loadingFor(listenerTrack).status).toEqual(FavoriteStatus.Loading())
    expect(readyFor(listenerTrack, true).status).toEqual(FavoriteStatus.Ready({ favorite: true }))
  })

  test('keeps the confirmed favorite while saving and only flips after server success', () => {
    const saving = run(
      [FavoriteEvent.SaveStarted({ key: listenerTrack })],
      readyFor(listenerTrack, false),
    )

    expect(saving.status).toEqual(FavoriteStatus.Saving({ favorite: false, target: true }))
    expect(
      run([FavoriteEvent.Saved({ key: listenerTrack, favorite: true })], saving).status,
    ).toEqual(FavoriteStatus.Ready({ favorite: true }))
  })

  test('ignores a second save while one is in flight', () => {
    const saving = run(
      [FavoriteEvent.SaveStarted({ key: listenerTrack })],
      readyFor(listenerTrack, false),
    )

    expect(run([FavoriteEvent.SaveStarted({ key: listenerTrack })], saving)).toBe(saving)
  })

  test('drops responses that belong to a previous track or account', () => {
    const current = readyFor(listenerOtherTrack, false)

    for (const stale of [listenerTrack, otherListenerTrack]) {
      const events = [
        FavoriteEvent.Loaded({ key: stale, favorite: true }),
        FavoriteEvent.Saved({ key: stale, favorite: true }),
        FavoriteEvent.Failed({ key: stale, error: new FavoriteSessionExpired() }),
      ]

      expect(run(events, current)).toBe(current)
    }

    expect(statusFor(current, listenerTrack)).toEqual(FavoriteStatus.Loading())
  })

  test('keeps the confirmed favorite visible when a save fails so it can be retried', () => {
    const failed = run(
      [
        FavoriteEvent.SaveStarted({ key: listenerTrack }),
        FavoriteEvent.Failed({ key: listenerTrack, error: new FavoriteRequestFailed() }),
      ],
      readyFor(listenerTrack, true),
    )

    expect(failed.status).toEqual(FavoriteStatus.SaveFailed({ favorite: true }))
    expect(run([FavoriteEvent.SaveStarted({ key: listenerTrack })], failed).status).toEqual(
      FavoriteStatus.Saving({ favorite: true, target: false }),
    )
  })

  test('classifies load failures, expired sessions and unavailable tracks', () => {
    const failLoad = (error: FavoriteError) =>
      run([FavoriteEvent.Failed({ key: listenerTrack, error })], loadingFor(listenerTrack)).status

    expect(failLoad(new FavoriteRequestFailed())).toEqual(FavoriteStatus.LoadFailed())
    expect(failLoad(new FavoriteSessionExpired())).toEqual(FavoriteStatus.SessionExpired())
    expect(failLoad(new FavoriteTrackUnavailable())).toEqual(FavoriteStatus.Unavailable())
  })

  test('cannot save before the state is known or after the session expired', () => {
    const loading = loadingFor(listenerTrack)

    const expired = run(
      [FavoriteEvent.Failed({ key: listenerTrack, error: new FavoriteSessionExpired() })],
      loading,
    )

    expect(run([FavoriteEvent.SaveStarted({ key: listenerTrack })], loading)).toBe(loading)
    expect(run([FavoriteEvent.SaveStarted({ key: listenerTrack })], expired)).toBe(expired)
  })

  test('dismisses only the current failure without changing the retry state', () => {
    const fail = (state: FavoriteState) =>
      run(
        [
          FavoriteEvent.SaveStarted({ key: listenerTrack }),
          FavoriteEvent.Failed({ key: listenerTrack, error: new FavoriteRequestFailed() }),
        ],
        state,
      )

    const first = fail(readyFor(listenerTrack, false))
    const id = first.notice?.id
    expect(id).toBeTypeOf('number')

    if (id === undefined) throw new Error('Expected a failure notice')

    const dismissed = run([FavoriteEvent.NoticeDismissed({ key: listenerTrack, id })], first)
    expect(dismissed.notice).toBeNull()
    expect(dismissed.status).toEqual(FavoriteStatus.SaveFailed({ favorite: false }))

    const newer = fail(dismissed)
    expect(newer.notice?.message).toBe(first.notice?.message)
    expect(newer.notice?.id).not.toBe(id)
    expect(run([FavoriteEvent.NoticeDismissed({ key: listenerTrack, id })], newer)).toBe(newer)

    for (const key of [listenerOtherTrack, otherListenerTrack, listenerTrack]) {
      const changed = run([FavoriteEvent.LoadStarted({ key })], newer)
      expect(changed.notice).toBeNull()
      expect(run([FavoriteEvent.NoticeDismissed({ key: listenerTrack, id })], changed)).toBe(
        changed,
      )
    }
  })
})
