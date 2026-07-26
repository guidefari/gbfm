import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  MediaSessionService,
  MediaSessionServiceLive,
  type MediaSessionHandlers
} from './media-session'

describe('MediaSessionService', () => {
  it('installs and clears action handlers through the service seam', async () => {
    const installed: Array<string | null> = []
    const original = globalThis.navigator

    const mediaSession = {
      metadata: null,
      playbackState: 'none',
      setActionHandler: (action: string, handler: MediaSessionActionHandler | null) => {
        installed.push(handler ? action : null)
      },
      setPositionState: () => undefined
    }

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { mediaSession }
    })

    try {
      const handlers: MediaSessionHandlers = {
        onPlay: () => undefined,
        onPause: () => undefined,
        onSeekBackward: () => undefined,
        onSeekForward: () => undefined,
        onPreviousTrack: () => undefined,
        onNextTrack: () => undefined,
        onSeekTo: () => undefined
      }

      await Effect.gen(function* () {
        const media = yield* MediaSessionService
        yield* media.setActionHandlers(handlers)
        yield* media.setPositionState(120, 12)
        yield* media.setActionHandlers(null)
      }).pipe(Effect.provide(MediaSessionServiceLive), Effect.runPromise)

      expect(installed.filter((entry) => entry !== null).length).toBeGreaterThanOrEqual(5)
      expect(installed.filter((entry) => entry === null).length).toBeGreaterThanOrEqual(5)
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: original
      })
    }
  })

  it('clears metadata and playback state through the service seam', async () => {
    const original = globalThis.navigator
    const mediaSession = {
      metadata: { title: 'Mix' },
      playbackState: 'playing',
      setActionHandler: () => undefined,
      setPositionState: () => undefined
    }

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { mediaSession }
    })

    try {
      await Effect.gen(function* () {
        const media = yield* MediaSessionService
        yield* media.clearMetadata()
      }).pipe(Effect.provide(MediaSessionServiceLive), Effect.runPromise)

      expect(mediaSession.metadata).toBeNull()
      expect(mediaSession.playbackState).toBe('none')
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: original
      })
    }
  })

  it('no-ops without a Media Session implementation', async () => {
    const original = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {}
    })

    try {
      let completed = false
      await Effect.gen(function* () {
        const media = yield* MediaSessionService
        yield* media.setMetadata('Title', ['Artist'])
        yield* media.clearMetadata()
        yield* media.setPlaybackState('playing')
        yield* media.setPositionState(1, 0)
        yield* media.setActionHandlers(null)
        completed = true
      }).pipe(Effect.provide(MediaSessionServiceLive), Effect.runPromise)
      expect(completed).toBe(true)
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: original
      })
    }
  })
})
