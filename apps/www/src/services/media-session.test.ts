import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MediaSessionService,
  MediaSessionServiceLayer,
  type MediaSessionHandlers
} from './media-session'

const run = <A, E>(effect: Effect.Effect<A, E, MediaSessionService>) =>
  effect.pipe(Effect.provide(MediaSessionServiceLayer), Effect.runPromise)

describe('MediaSessionService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('synchronizes playback metadata, state, position, and controls with the browser', async () => {
    const actionHandlers = new Map<string, MediaSessionActionHandler | null>()
    const positionStates: MediaPositionState[] = []
    const mediaSession = {
      metadata: null,
      playbackState: 'none',
      setActionHandler: (action: string, handler: MediaSessionActionHandler | null) => {
        actionHandlers.set(action, handler)
      },
      setPositionState: (state: MediaPositionState) => {
        positionStates.push(state)
      }
    } satisfies Pick<
      MediaSession,
      'metadata' | 'playbackState' | 'setActionHandler' | 'setPositionState'
    >
    vi.stubGlobal('navigator', { mediaSession })
    function RecordingMediaMetadata(this: MediaMetadata, init: MediaMetadataInit) {
      Object.assign(this, init)
    }
    vi.stubGlobal('MediaMetadata', RecordingMediaMetadata)

    const calls: Array<string | [string, number]> = []
    const handlers: MediaSessionHandlers = {
      onPlay: () => calls.push('play'),
      onPause: () => calls.push('pause'),
      onSeekBackward: (offset) => calls.push(['backward', offset]),
      onSeekForward: (offset) => calls.push(['forward', offset]),
      onPreviousTrack: () => calls.push('previous'),
      onNextTrack: () => calls.push('next'),
      onSeekTo: (time) => calls.push(['seekto', time])
    }

    await run(
      Effect.gen(function* () {
        const media = yield* MediaSessionService
        yield* media.setMetadata('Night Mix', ['DJ One', 'DJ Two'], 'https://cdn.example/art.jpg')
        yield* media.setPlaybackState('playing')
        yield* media.setPositionState(120, 200)
        yield* media.setActionHandlers(handlers)
      })
    )

    actionHandlers.get('play')?.({ action: 'play' })
    actionHandlers.get('pause')?.({ action: 'pause' })
    actionHandlers.get('seekbackward')?.({ action: 'seekbackward' })
    actionHandlers.get('seekforward')?.({ action: 'seekforward', seekOffset: 5 })
    actionHandlers.get('previoustrack')?.({ action: 'previoustrack' })
    actionHandlers.get('nexttrack')?.({ action: 'nexttrack' })
    actionHandlers.get('seekto')?.({ action: 'seekto', seekTime: 42 })

    expect(mediaSession.metadata).toMatchObject({
      title: 'Night Mix',
      artist: 'DJ One, DJ Two',
      artwork: [{ src: 'https://cdn.example/art.jpg' }]
    })
    expect(mediaSession.playbackState).toBe('playing')
    expect(positionStates).toEqual([{ duration: 120, playbackRate: 1, position: 120 }])
    expect(calls).toEqual([
      'play',
      'pause',
      ['backward', 15],
      ['forward', 5],
      'previous',
      'next',
      ['seekto', 42]
    ])

    await run(
      Effect.gen(function* () {
        const media = yield* MediaSessionService
        yield* media.setActionHandlers(null)
        yield* media.clearMetadata()
      })
    )

    expect([...actionHandlers.values()]).toEqual(Array.from({ length: 7 }, () => null))
    expect(mediaSession.metadata).toBeNull()
    expect(mediaSession.playbackState).toBe('none')
  })

  it('keeps playback usable when the browser does not support Media Session', async () => {
    vi.stubGlobal('navigator', {})

    await expect(
      run(
        Effect.gen(function* () {
          const media = yield* MediaSessionService
          yield* media.setMetadata('Title', ['Artist'])
          yield* media.clearMetadata()
          yield* media.setPlaybackState('playing')
          yield* media.setPositionState(1, 0)
          yield* media.setActionHandlers(null)
        })
      )
    ).resolves.toBeUndefined()
  })
})
