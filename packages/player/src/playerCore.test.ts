import { Effect, Layer, PubSub, Stream } from 'effect'
import { describe, expect, it } from 'vitest'
import { AudioEngine, PlaybackRejected, type AudioEngineShape, type EngineStatus } from './engine'
import type { QueueTrackType } from './persistedQueue'
import { PlayReporter } from './playReporter'
import { makePlayerCore } from './playerCore'
import { PlayerStorage, type PositionRecord } from './playerStorage'

const track: QueueTrackType = {
  id: 'track-1',
  title: 'Test Mix',
  slug: 'test-mix',
  url: 'https://cdn.example/test.mp3',
  thumbnailUrl: null,
  type: 'mix',
  creators: [{ id: 'c1', name: 'Tester', username: 'tester' }]
}

const idleStatus: EngineStatus = {
  sourceGeneration: null,
  isLoaded: false,
  playing: false,
  didJustFinish: false,
  currentTime: 0,
  duration: 0,
  isBuffering: false
}

const makeRecordingEngine = (options: { readonly rejectPlay?: boolean } = {}) =>
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<EngineStatus>()
    const calls: Array<string> = []
    let status = idleStatus

    const engine: AudioEngineShape = {
      replace: (url, sourceGeneration) =>
        Effect.sync(() => {
          status = { ...status, sourceGeneration }
          calls.push(`replace:${url}`)
        }),
      play: options.rejectPlay
        ? Effect.suspend(() => {
            calls.push('play:rejected')
            return Effect.fail(new PlaybackRejected({}))
          })
        : Effect.sync(() => {
            calls.push('play')
          }),
      pause: Effect.sync(() => {
        calls.push('pause')
      }),
      seekTo: (seconds) =>
        Effect.sync(() => {
          calls.push(`seek:${seconds}`)
        }),
      currentStatus: Effect.sync(() => status),
      changes: Stream.fromPubSub(pubsub),
      setNowPlaying: (metadata) =>
        Effect.sync(() => {
          calls.push(`nowPlaying:${metadata ? metadata.title : 'null'}`)
        })
    }

    const emit = (next: Partial<EngineStatus>) =>
      Effect.suspend(() => {
        status = { ...status, ...next }
        return PubSub.publish(pubsub, status)
      })

    /** Updates what the engine reports without publishing, modelling a source
     *  that became ready before the core read its status. */
    const setStatus = (next: Partial<EngineStatus>) =>
      Effect.sync(() => {
        status = { ...status, ...next }
      })

    return { engine, calls, emit, setStatus }
  })

const makeRecordingStorage = (stored: PositionRecord | null = null) => {
  const saved: Array<{ readonly id: string; readonly position: number }> = []
  const cleared: Array<string> = []

  const layer = Layer.succeed(PlayerStorage, {
    loadQueue: () => Effect.succeed(null),
    saveQueue: () => Effect.void,
    loadPosition: () => Effect.succeed(stored),
    savePosition: (id: string, position: number) =>
      Effect.sync(() => {
        saved.push({ id, position })
      }),
    clearPosition: (id: string) =>
      Effect.sync(() => {
        cleared.push(id)
      }),
    recordPlay: () => Effect.void,
    isWithinDedupWindow: () => Effect.succeed(false)
  })

  return { layer, saved, cleared }
}

const makeRecordingReporter = () => {
  const reported: Array<string> = []
  const layer = Layer.succeed(PlayReporter, {
    recordPlay: (trackId: string) =>
      Effect.sync(() => {
        reported.push(trackId)
      })
  })
  return { layer, reported }
}

describe('makePlayerCore', () => {
  it('restores a stored position before starting playback', async () => {
    const program = Effect.gen(function* () {
      const { engine, calls, setStatus } = yield* makeRecordingEngine()
      const storage = makeRecordingStorage({ position: 42, updatedAt: 0 })
      const reporter = makeRecordingReporter()

      const core = yield* makePlayerCore({
        onStatus: () => {},
        onTrackFinished: () => {}
      }).pipe(
        Effect.provide(
          Layer.mergeAll(Layer.succeed(AudioEngine, engine), storage.layer, reporter.layer)
        )
      )

      yield* core.requestPlayOnReady(track.id)
      yield* setStatus({ isLoaded: true, duration: 300 })
      yield* core.setSource(track)
      yield* Effect.yieldNow

      return { calls, reported: reporter.reported }
    }).pipe(Effect.scoped)

    const { calls, reported } = await Effect.runPromise(program)

    expect(calls).toContain('seek:42')
    expect(calls.indexOf('seek:42')).toBeLessThan(calls.indexOf('play'))
    expect(reported).toEqual([track.id])
  })

  it('restores the position when a cached source reports loaded before its duration', async () => {
    const program = Effect.gen(function* () {
      const { engine, calls, emit, setStatus } = yield* makeRecordingEngine()
      const storage = makeRecordingStorage({ position: 42, updatedAt: 0 })
      const reporter = makeRecordingReporter()

      const core = yield* makePlayerCore({
        onStatus: () => {},
        onTrackFinished: () => {}
      }).pipe(
        Effect.provide(
          Layer.mergeAll(Layer.succeed(AudioEngine, engine), storage.layer, reporter.layer)
        )
      )

      yield* core.requestPlayOnReady(track.id)
      // Safari serves a cached source as readyState >= 1 with duration NaN,
      // which the engine reports as 0 until durationchange lands.
      yield* setStatus({ isLoaded: true, duration: 0 })
      yield* core.setSource(track)
      yield* Effect.yieldNow

      const beforeDuration = [...calls]

      yield* emit({ isLoaded: true, duration: 300 })
      yield* Effect.yieldNow

      return { beforeDuration, calls }
    }).pipe(Effect.scoped)

    const { beforeDuration, calls } = await Effect.runPromise(program)

    expect(beforeDuration).not.toContain('play')
    expect(calls).toContain('seek:42')
    expect(calls.indexOf('seek:42')).toBeLessThan(calls.indexOf('play'))
  })

  it('does not seek when the stored position is near the end', async () => {
    const program = Effect.gen(function* () {
      const { engine, calls, setStatus } = yield* makeRecordingEngine()
      const storage = makeRecordingStorage({ position: 298, updatedAt: 0 })
      const reporter = makeRecordingReporter()

      const core = yield* makePlayerCore({
        onStatus: () => {},
        onTrackFinished: () => {}
      }).pipe(
        Effect.provide(
          Layer.mergeAll(Layer.succeed(AudioEngine, engine), storage.layer, reporter.layer)
        )
      )

      yield* core.requestPlayOnReady(track.id)
      yield* setStatus({ isLoaded: true, duration: 300 })
      yield* core.setSource(track)
      yield* Effect.yieldNow

      return calls
    }).pipe(Effect.scoped)

    const calls = await Effect.runPromise(program)
    expect(calls.some((call) => call.startsWith('seek:'))).toBe(false)
    expect(calls).toContain('play')
  })

  it('clears intent and skips play reporting when the platform refuses playback', async () => {
    const program = Effect.gen(function* () {
      const { engine, setStatus } = yield* makeRecordingEngine({ rejectPlay: true })
      const storage = makeRecordingStorage()
      const reporter = makeRecordingReporter()
      const errors: Array<string> = []

      const core = yield* makePlayerCore({
        onStatus: () => {},
        onTrackFinished: () => {},
        onError: (message) => errors.push(message)
      }).pipe(
        Effect.provide(
          Layer.mergeAll(Layer.succeed(AudioEngine, engine), storage.layer, reporter.layer)
        )
      )

      yield* core.requestPlayOnReady(track.id)
      yield* setStatus({ isLoaded: true, duration: 300 })
      yield* core.setSource(track)
      yield* Effect.yieldNow

      return { reported: reporter.reported, desired: yield* core.isDesiredPlaying, errors }
    }).pipe(Effect.scoped)

    const { reported, desired, errors } = await Effect.runPromise(program)

    expect(reported).toEqual([])
    expect(desired).toBe(false)
    expect(errors).toContain('Playback was refused by the platform')
  })

  it('tears down the source and pauses when set to null', async () => {
    const program = Effect.gen(function* () {
      const { engine, calls, setStatus } = yield* makeRecordingEngine()
      const storage = makeRecordingStorage()
      const reporter = makeRecordingReporter()

      const core = yield* makePlayerCore({
        onStatus: () => {},
        onTrackFinished: () => {}
      }).pipe(
        Effect.provide(
          Layer.mergeAll(Layer.succeed(AudioEngine, engine), storage.layer, reporter.layer)
        )
      )

      yield* setStatus({ isLoaded: true, duration: 300 })
      yield* core.setSource(track)
      yield* Effect.yieldNow

      yield* core.setSource(null)
      yield* Effect.yieldNow

      return { calls, trackId: yield* core.currentTrackId }
    }).pipe(Effect.scoped)

    const { calls, trackId } = await Effect.runPromise(program)

    expect(trackId).toBeNull()
    expect(calls).toContain('nowPlaying:null')
    expect(calls.lastIndexOf('pause')).toBeGreaterThan(calls.indexOf('replace:' + track.url))
  })

  it('ignores delayed statuses from the previous source', async () => {
    const nextTrack: QueueTrackType = {
      ...track,
      id: 'track-2',
      url: 'https://cdn.example/next.mp3'
    }

    const program = Effect.gen(function* () {
      const { engine, calls, emit, setStatus } = yield* makeRecordingEngine()
      const storage = makeRecordingStorage()
      const reporter = makeRecordingReporter()
      const observed: Array<EngineStatus> = []
      let finished = 0

      const core = yield* makePlayerCore({
        onStatus: (status) => observed.push(status),
        onTrackFinished: () => {
          finished += 1
        }
      }).pipe(
        Effect.provide(
          Layer.mergeAll(Layer.succeed(AudioEngine, engine), storage.layer, reporter.layer)
        )
      )

      yield* setStatus({ isLoaded: true, duration: 300 })
      yield* core.setSource(track)
      yield* setStatus({ isLoaded: false, duration: 0 })
      yield* core.requestPlayOnReady(nextTrack.id)
      yield* core.setSource(nextTrack)
      const callsBeforeStaleStatus = calls.length

      yield* emit({
        sourceGeneration: 1,
        isLoaded: true,
        duration: 300,
        playing: false,
        didJustFinish: true
      })
      yield* Effect.yieldNow

      const callsAfterStaleStatus = calls.length
      yield* emit({
        sourceGeneration: 2,
        isLoaded: true,
        duration: 300,
        didJustFinish: false
      })
      yield* Effect.yieldNow

      return {
        calls,
        callsBeforeStaleStatus,
        callsAfterStaleStatus,
        finished,
        observed,
        trackId: yield* core.currentTrackId
      }
    }).pipe(Effect.scoped)

    const result = await Effect.runPromise(program)

    expect(result.callsAfterStaleStatus).toBe(result.callsBeforeStaleStatus)
    expect(
      result.observed.some((status) => status.sourceGeneration === 1 && status.didJustFinish)
    ).toBe(false)
    expect(result.calls).toContain('play')
    expect(result.finished).toBe(0)
    expect(result.trackId).toBe(nextTrack.id)
  })

  it('clears the stored position and notifies when a track finishes', async () => {
    const program = Effect.gen(function* () {
      const { engine, emit, setStatus } = yield* makeRecordingEngine()
      const storage = makeRecordingStorage()
      const reporter = makeRecordingReporter()
      let finished = 0

      const core = yield* makePlayerCore({
        onStatus: () => {},
        onTrackFinished: () => {
          finished += 1
        }
      }).pipe(
        Effect.provide(
          Layer.mergeAll(Layer.succeed(AudioEngine, engine), storage.layer, reporter.layer)
        )
      )

      yield* core.requestPlayOnReady(track.id)
      yield* setStatus({ isLoaded: true, duration: 300 })
      yield* core.setSource(track)
      yield* Effect.yieldNow
      yield* emit({ playing: true, currentTime: 300 })
      yield* Effect.yieldNow
      yield* emit({ playing: false, didJustFinish: true })
      yield* Effect.yieldNow

      return { finished, cleared: storage.cleared }
    }).pipe(Effect.scoped)

    const { finished, cleared } = await Effect.runPromise(program)

    expect(finished).toBe(1)
    expect(cleared).toEqual([track.id])
  })

  it('persists playback position as the track advances', async () => {
    const program = Effect.gen(function* () {
      const { engine, emit, setStatus } = yield* makeRecordingEngine()
      const storage = makeRecordingStorage()
      const reporter = makeRecordingReporter()

      const core = yield* makePlayerCore({
        onStatus: () => {},
        onTrackFinished: () => {}
      }).pipe(
        Effect.provide(
          Layer.mergeAll(Layer.succeed(AudioEngine, engine), storage.layer, reporter.layer)
        )
      )

      yield* core.requestPlayOnReady(track.id)
      yield* setStatus({ isLoaded: true, duration: 300 })
      yield* core.setSource(track)
      yield* Effect.yieldNow
      yield* emit({ playing: true, currentTime: 30 })
      yield* Effect.yieldNow

      return storage.saved
    }).pipe(Effect.scoped)

    const saved = await Effect.runPromise(program)
    expect(saved.some((entry) => entry.id === track.id && entry.position === 30)).toBe(true)
  })

  it('interrupts the status fiber when the enclosing scope closes', async () => {
    let finalized = false
    let callbacksAfterDispose = 0

    const program = Effect.gen(function* () {
      const pubsub = yield* PubSub.unbounded<EngineStatus>()
      let status = idleStatus

      const engine: AudioEngineShape = {
        replace: (_url, sourceGeneration) =>
          Effect.sync(() => {
            status = { ...status, sourceGeneration }
          }),
        play: Effect.void,
        pause: Effect.void,
        seekTo: () => Effect.void,
        currentStatus: Effect.sync(() => status),
        changes: Stream.fromPubSub(pubsub).pipe(
          Stream.ensuring(
            Effect.sync(() => {
              finalized = true
            })
          )
        ),
        setNowPlaying: () => Effect.void
      }

      const storage = makeRecordingStorage()
      const reporter = makeRecordingReporter()

      yield* makePlayerCore({
        onStatus: () => {
          callbacksAfterDispose += 1
        },
        onTrackFinished: () => {}
      }).pipe(
        Effect.provide(
          Layer.mergeAll(Layer.succeed(AudioEngine, engine), storage.layer, reporter.layer)
        )
      )

      yield* PubSub.publish(pubsub, {
        ...idleStatus,
        sourceGeneration: 1,
        isLoaded: true,
        duration: 300
      })
      yield* Effect.yieldNow

      return pubsub
    }).pipe(Effect.scoped)

    const pubsub = await Effect.runPromise(program)

    expect(finalized).toBe(true)

    const before = callbacksAfterDispose
    await Effect.runPromise(PubSub.publish(pubsub, { ...idleStatus, isLoaded: true, duration: 1 }))
    await Effect.runPromise(Effect.yieldNow)
    expect(callbacksAfterDispose).toBe(before)
  })
})
