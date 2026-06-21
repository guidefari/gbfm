import { describe, expect, test } from 'vitest'
import { initialPlayerState, playerReducer, type QueueItem } from './machine'

const queueItemA: QueueItem = {
  queueId: 'queue-a',
  id: 'mix-a',
  title: 'Mix A',
  url: 'https://cdn.example.com/a.mp3',
  thumbnailUrl: 'https://cdn.example.com/a.jpg',
  slug: 'mix-a',
  addedAt: 1
}

const queueItemB: QueueItem = {
  queueId: 'queue-b',
  id: 'mix-b',
  title: 'Mix B',
  url: 'https://cdn.example.com/b.mp3',
  thumbnailUrl: 'https://cdn.example.com/b.jpg',
  slug: 'mix-b',
  addedAt: 2
}

const queueItemC: QueueItem = {
  queueId: 'queue-c',
  id: 'mix-c',
  title: 'Mix C',
  url: 'https://cdn.example.com/c.mp3',
  thumbnailUrl: 'https://cdn.example.com/c.jpg',
  slug: 'mix-c',
  addedAt: 3
}

describe('playerReducer', () => {
  test('loads a track and resets playback progress', () => {
    const next = playerReducer(
      { ...initialPlayerState, currentTime: 99, progress: 80 },
      {
        type: 'LOAD_TRACK',
        src: 'https://cdn.example.com/mix.mp3',
        thumbnailUrl: 'https://cdn.example.com/mix.jpg',
        title: 'Loaded Mix',
        trackId: 'mix-1',
        slug: 'loaded-mix',
        pageUrl: '/mixes/loaded-mix'
      }
    )

    expect(next.audioSrc).toBe('https://cdn.example.com/mix.mp3')
    expect(next.thumbnailUrl).toBe('https://cdn.example.com/mix.jpg')
    expect(next.currentTrackId).toBe('mix-1')
    expect(next.currentTime).toBe(0)
    expect(next.progress).toBe(0)
    expect(next.isPlaying).toBe(true)
    expect(next.nowPlayingContext).toEqual({
      title: 'Loaded Mix',
      url: '/mixes/loaded-mix',
      slug: 'loaded-mix',
      creators: undefined
    })
  })

  test('preloads a track without forcing playback', () => {
    const next = playerReducer(initialPlayerState, {
      type: 'PRELOAD_TRACK',
      src: 'https://cdn.example.com/mix.mp3',
      thumbnailUrl: 'https://cdn.example.com/mix.jpg',
      title: 'Preloaded Mix',
      trackId: 'mix-1',
      pageUrl: '/mixes/preloaded-mix'
    })

    expect(next.audioSrc).toBe('https://cdn.example.com/mix.mp3')
    expect(next.isPlaying).toBe(false)
    expect(next.currentTime).toBe(0)
    expect(next.progress).toBe(0)
  })

  test('preserves existing progress math for zero duration updates', () => {
    const next = playerReducer(initialPlayerState, {
      type: 'UPDATE_PROGRESS',
      currentTime: 10,
      duration: 0
    })

    expect(next.progress).toBe(Infinity)
    expect(next.currentTime).toBe(10)
    expect(next.duration).toBe(0)
  })

  test('clamps volume and mutes when volume reaches zero', () => {
    const tooHigh = playerReducer(initialPlayerState, { type: 'SET_VOLUME', volume: 150 })
    const tooLow = playerReducer(initialPlayerState, { type: 'SET_VOLUME', volume: -10 })

    expect(tooHigh.volume).toBe(100)
    expect(tooHigh.isMuted).toBe(false)
    expect(tooLow.volume).toBe(0)
    expect(tooLow.isMuted).toBe(true)
  })

  test('adds queue items provided by the workflow Module', () => {
    const next = playerReducer(initialPlayerState, { type: 'ADD_TO_QUEUE', item: queueItemA })

    expect(next.queue).toEqual([queueItemA])
  })

  test('removes queue items and adjusts current index', () => {
    const next = playerReducer(
      { ...initialPlayerState, queue: [queueItemA, queueItemB, queueItemC], currentIndex: 2 },
      { type: 'REMOVE_FROM_QUEUE', queueId: 'queue-b' }
    )

    expect(next.queue).toEqual([queueItemA, queueItemC])
    expect(next.currentIndex).toBe(1)
  })

  test('reorders queue items and preserves the current track index', () => {
    const next = playerReducer(
      { ...initialPlayerState, queue: [queueItemA, queueItemB, queueItemC], currentIndex: 1 },
      { type: 'REORDER_QUEUE', fromIndex: 0, toIndex: 2 }
    )

    expect(next.queue).toEqual([queueItemB, queueItemC, queueItemA])
    expect(next.currentIndex).toBe(0)
  })

  test('marks playback stopped when track ends', () => {
    const next = playerReducer({ ...initialPlayerState, isPlaying: true }, { type: 'TRACK_ENDED' })

    expect(next.isPlaying).toBe(false)
  })
})
