import { describe, expect, test } from 'vitest'
import {
  createQueueItem,
  resolveLoadTrack,
  resolvePauseEffects,
  resolvePercentageSeek,
  resolveProgressUpdate,
  resolveRelativeSeek
} from './workflow'

describe('audio player workflow', () => {
  test('returns no-preview when no source is available', () => {
    expect(
      resolveLoadTrack(
        { audioSrc: null, isPlaying: false, currentTime: 0, currentTrackId: null },
        { src: '', thumbnailUrl: '', title: 'Untitled' },
        '/mixes/untitled'
      )
    ).toEqual({ type: 'no-preview' })
  })

  test('resumes the current track when the same source is paused', () => {
    expect(
      resolveLoadTrack(
        {
          audioSrc: 'https://cdn.example.com/mix.mp3',
          isPlaying: false,
          currentTime: 12,
          currentTrackId: 'mix-1'
        },
        { src: 'https://cdn.example.com/mix.mp3', thumbnailUrl: '', title: 'Paused Mix' },
        '/mixes/paused-mix'
      )
    ).toEqual({ type: 'resume-current', title: 'Paused Mix' })
  })

  test('pauses the current track when the same source is playing', () => {
    expect(
      resolveLoadTrack(
        {
          audioSrc: 'https://cdn.example.com/mix.mp3',
          isPlaying: true,
          currentTime: 12,
          currentTrackId: 'mix-1'
        },
        { src: 'https://cdn.example.com/mix.mp3', thumbnailUrl: '', title: 'Playing Mix' },
        '/mixes/playing-mix'
      )
    ).toEqual({ type: 'pause-current' })
  })

  test('loads a new track with metadata, analytics, and previous position persistence', () => {
    const decision = resolveLoadTrack(
      {
        audioSrc: 'https://cdn.example.com/old.mp3',
        isPlaying: true,
        currentTime: 42,
        currentTrackId: 'old-1'
      },
      {
        src: 'https://cdn.example.com/new.mp3',
        thumbnailUrl: 'https://cdn.example.com/new.jpg',
        title: 'New Mix',
        trackId: 'new-1',
        slug: 'new-mix'
      },
      '/mixes/new-mix'
    )

    expect(decision).toEqual({
      type: 'load-new',
      src: 'https://cdn.example.com/new.mp3',
      action: {
        type: 'LOAD_TRACK',
        src: 'https://cdn.example.com/new.mp3',
        thumbnailUrl: 'https://cdn.example.com/new.jpg',
        title: 'New Mix',
        trackId: 'new-1',
        creators: undefined,
        slug: 'new-mix',
        pageUrl: '/mixes/new-mix'
      },
      metadata: {
        title: 'New Mix',
        artists: [],
        artwork: 'https://cdn.example.com/new.jpg'
      },
      playedEvent: {
        trackId: 'new-1',
        title: 'New Mix',
        slug: 'new-mix',
        pageUrl: '/mixes/new-mix'
      },
      persistPreviousPosition: { trackId: 'old-1', time: 42 }
    })
  })

  test('does not persist previous position when current time is zero', () => {
    const decision = resolveLoadTrack(
      {
        audioSrc: 'https://cdn.example.com/old.mp3',
        isPlaying: true,
        currentTime: 0,
        currentTrackId: 'old-1'
      },
      { src: 'https://cdn.example.com/new.mp3', thumbnailUrl: '', title: 'New Mix' },
      '/mixes/new-mix'
    )

    expect(decision).toEqual({
      type: 'load-new',
      src: 'https://cdn.example.com/new.mp3',
      action: {
        type: 'LOAD_TRACK',
        src: 'https://cdn.example.com/new.mp3',
        thumbnailUrl: '',
        title: 'New Mix',
        trackId: undefined,
        creators: undefined,
        slug: undefined,
        pageUrl: '/mixes/new-mix'
      },
      metadata: {
        title: 'New Mix',
        artists: [],
        artwork: ''
      },
      playedEvent: {
        trackId: null,
        title: 'New Mix',
        slug: null,
        pageUrl: '/mixes/new-mix'
      },
      persistPreviousPosition: undefined
    })
  })

  test('builds pause effects with optional position persistence', () => {
    expect(
      resolvePauseEffects({
        currentTime: 33,
        currentTrackId: 'mix-1',
        nowPlayingContext: { title: 'Deep Mix', url: '/mixes/deep-mix' },
        progress: 25
      })
    ).toEqual({
      playbackState: 'paused',
      persistPosition: { trackId: 'mix-1', time: 33 },
      pausedEvent: {
        trackId: 'mix-1',
        title: 'Deep Mix',
        progressPercent: 25,
        currentTime: 33
      }
    })
  })

  test('does not persist pause position without a positive time and track id', () => {
    expect(
      resolvePauseEffects({
        currentTime: 0,
        currentTrackId: null,
        nowPlayingContext: { title: 'Nothing playing, yet', url: '/' },
        progress: 0
      }).persistPosition
    ).toBeUndefined()
  })

  test('builds keyboard seek decisions without clamping browser time', () => {
    expect(
      resolveRelativeSeek({
        fromTime: 10,
        deltaSeconds: -15,
        trackId: 'mix-1',
        method: 'keyboard'
      })
    ).toEqual({
      toTime: -5,
      seekEvent: {
        trackId: 'mix-1',
        fromTime: 10,
        toTime: -5,
        method: 'keyboard'
      }
    })
  })

  test('builds scrub seek decisions and reducer action', () => {
    expect(
      resolvePercentageSeek({
        percentage: 25,
        duration: 200,
        fromTime: 10,
        trackId: 'mix-1'
      })
    ).toEqual({
      toTime: 50,
      action: { type: 'SET_TIME', percentage: 25, duration: 200 },
      seekEvent: {
        trackId: 'mix-1',
        fromTime: 10,
        toTime: 50,
        method: 'scrub'
      }
    })
  })

  test('persists progress only when the interval has elapsed', () => {
    expect(
      resolveProgressUpdate({
        currentTime: 12,
        duration: 100,
        currentTrackId: 'mix-1',
        now: 6_000,
        lastPersistTime: 1_000,
        persistInterval: 5_000
      })
    ).toEqual({
      action: { type: 'UPDATE_PROGRESS', currentTime: 12, duration: 100 },
      nextLastPersistTime: 6_000,
      persistPosition: { trackId: 'mix-1', time: 12 },
      positionState: { duration: 100, position: 12 }
    })
  })

  test('still updates progress without persistence before the interval has elapsed', () => {
    expect(
      resolveProgressUpdate({
        currentTime: 12,
        duration: 100,
        currentTrackId: 'mix-1',
        now: 5_999,
        lastPersistTime: 1_000,
        persistInterval: 5_000
      })
    ).toEqual({
      action: { type: 'UPDATE_PROGRESS', currentTime: 12, duration: 100 },
      nextLastPersistTime: 1_000,
      persistPosition: undefined,
      positionState: undefined
    })
  })

  test('updates persistence time even when no track id exists', () => {
    expect(
      resolveProgressUpdate({
        currentTime: 12,
        duration: 100,
        currentTrackId: null,
        now: 6_000,
        lastPersistTime: 1_000,
        persistInterval: 5_000
      })
    ).toEqual({
      action: { type: 'UPDATE_PROGRESS', currentTime: 12, duration: 100 },
      nextLastPersistTime: 6_000,
      persistPosition: undefined,
      positionState: undefined
    })
  })

  test('creates deterministic queue items from adapter-supplied time and id suffix', () => {
    expect(
      createQueueItem({
        mix: {
          id: 'mix-1',
          title: 'Queued Mix',
          url: 'https://cdn.example.com/queued.mp3',
          thumbnailUrl: null,
          slug: 'queued-mix'
        },
        queueIdTime: 1_000,
        addedAt: 1_001,
        idSuffix: 'abc123'
      })
    ).toEqual({
      queueId: 'queue-1000-abc123',
      id: 'mix-1',
      title: 'Queued Mix',
      url: 'https://cdn.example.com/queued.mp3',
      thumbnailUrl: '',
      slug: 'queued-mix',
      addedAt: 1_001,
      creators: undefined
    })
  })
})
