import { describe, expect, test } from 'vitest'

import type { QueueTrackType } from './persistedQueue'
import { initialQueueState, mergeHydratedQueue, QueueAction, reduceQueue } from './queueState'

const track = (id: string): QueueTrackType => ({
  id,
  title: id,
  slug: id,
  url: `https://example.com/${id}.mp3`,
  thumbnailUrl: null,
  type: 'mix',
})

describe('audio queue state', () => {
  test('enqueue does not select or interrupt the current track', () => {
    const current = track('current')
    const state = { tracks: [current], currentIndex: 0 }

    const appended = reduceQueue(state, QueueAction.enqueue({ track: track('next') }))
    const inserted = reduceQueue(state, QueueAction.enqueue({ track: track('before'), at: 0 }))

    expect(appended.currentIndex).toBe(0)
    expect(appended.tracks[appended.currentIndex]?.id).toBe('current')
    expect(inserted.currentIndex).toBe(1)
    expect(inserted.tracks[inserted.currentIndex]?.id).toBe('current')
  })

  test('enqueueAll remains unselected when nothing is playing', () => {
    const state = reduceQueue(
      initialQueueState,
      QueueAction.enqueueAll({
        tracks: [track('one'), track('two')],
      }),
    )

    expect(state.currentIndex).toBe(-1)
    expect(state.tracks.map(({ id }) => id)).toEqual(['one', 'two'])
  })

  test('playAll atomically replaces the queue and selects its first unique track', () => {
    const state = reduceQueue(
      { tracks: [track('old')], currentIndex: 0 },
      QueueAction.playAll({ tracks: [track('one'), track('one'), track('two')] }),
    )

    expect(state.currentIndex).toBe(0)
    expect(state.tracks.map(({ id }) => id)).toEqual(['one', 'two'])
  })

  test('hydration replays early actions over the stored queue', () => {
    const stored = { tracks: [track('stored')], currentIndex: 0 }

    const hydrated = mergeHydratedQueue(stored, [
      QueueAction.enqueue({ track: track('early') }),
      QueueAction.playIndex({ index: 1 }),
    ])

    expect(hydrated.tracks.map(({ id }) => id)).toEqual(['stored', 'early'])
    expect(hydrated.currentIndex).toBe(1)
  })

  test('replays pending actions over an empty fallback when hydration fails', () => {
    const hydrated = mergeHydratedQueue(initialQueueState, [
      QueueAction.enqueue({ track: track('early') }),
    ])

    expect(hydrated).toEqual({ tracks: [track('early')], currentIndex: -1 })
  })

  test('selects the following track when the current track is removed', () => {
    const state = reduceQueue(
      { tracks: [track('one'), track('two'), track('three')], currentIndex: 1 },
      QueueAction.remove({ index: 1 }),
    )

    expect(state.tracks.map(({ id }) => id)).toEqual(['one', 'three'])
    expect(state.tracks[state.currentIndex]?.id).toBe('three')
  })

  test('clear removes both tracks and current selection', () => {
    expect(reduceQueue({ tracks: [track('one')], currentIndex: 0 }, QueueAction.clear())).toEqual(
      initialQueueState,
    )
  })
})
