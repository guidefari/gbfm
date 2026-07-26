import { Effect, ManagedRuntime } from 'effect'
import type { Scope } from 'effect/Scope'
import { AudioEngine, type EngineStatus } from './engine'
import { type QueueTrackType } from './persistedQueue'
import { PlayReporter } from './playReporter'
import { makePlayerCore } from './playerCore'
import { PlayerStorage } from './playerStorage'
import type { VolumeRecordType } from './audioStorage'
import { initialQueueState, mergeHydratedQueue, reduceQueue, type QueueAction } from './queueState'

export const selectQueueView = (state: typeof initialQueueState) => ({
  tracks: state.tracks,
  currentIndex: state.currentIndex,
  current: state.currentIndex >= 0 ? (state.tracks[state.currentIndex] ?? null) : null
})

export type QueueView = ReturnType<typeof selectQueueView>

export type PlaybackTransportSnapshot = {
  readonly isInitialized: boolean
  readonly isLoaded: boolean
  readonly isPlaying: boolean
  readonly isBuffering: boolean
  readonly currentTime: number
  readonly duration: number
}

export type PlaybackSnapshot = {
  readonly queue: QueueView
  readonly transport: PlaybackTransportSnapshot
  readonly volume: VolumeRecordType
}

export type AudioPlaybackReporter = {
  readonly onTrackPlayed?: (track: QueueTrackType) => Effect.Effect<void>
  readonly onTrackPaused?: (input: {
    readonly trackId: string | null
    readonly title: string
    readonly currentTime: number
    readonly duration: number
  }) => Effect.Effect<void>
  readonly onTrackCompleted?: (input: {
    readonly trackId: string | null
    readonly title: string
    readonly duration: number
  }) => Effect.Effect<void>
  readonly onTrackSeek?: (input: {
    readonly trackId: string | null
    readonly fromTime: number
    readonly toTime: number
    readonly method: 'scrub' | 'keyboard' | 'mediasession'
  }) => Effect.Effect<void>
  readonly onQueueAction?: (input: {
    readonly action: 'add' | 'remove' | 'reorder' | 'clear' | 'play_from'
    readonly trackId?: string
    readonly queueLength: number
  }) => Effect.Effect<void>
  readonly onError?: (message: string, error: unknown) => Effect.Effect<void>
}

export type AudioPlaybackCallbacks = AudioPlaybackReporter

type PlaybackRuntime = Pick<
  ManagedRuntime.ManagedRuntime<AudioEngine | PlayerStorage | PlayReporter, never>,
  'runFork' | 'runPromise'
>

type SnapshotListener = (snapshot: PlaybackSnapshot) => void

const initialTransport: PlaybackTransportSnapshot = {
  isInitialized: false,
  isLoaded: false,
  isPlaying: false,
  isBuffering: false,
  currentTime: 0,
  duration: 0
}

const defaultVolume: VolumeRecordType = { volume: 100, isMuted: false }

const noopReporter: Required<AudioPlaybackReporter> = {
  onTrackPlayed: () => Effect.void,
  onTrackPaused: () => Effect.void,
  onTrackCompleted: () => Effect.void,
  onTrackSeek: () => Effect.void,
  onQueueAction: () => Effect.void,
  onError: () => Effect.void
}

const buildSnapshot = (
  queue: typeof initialQueueState,
  transport: PlaybackTransportSnapshot,
  volume: VolumeRecordType
): PlaybackSnapshot => ({
  queue: selectQueueView(queue),
  transport,
  volume
})

const queueLength = (state: typeof initialQueueState) => state.tracks.length

const queueTrackInfo = (track: QueueTrackType | null) => ({
  trackId: track?.id ?? null,
  title: track?.title ?? 'unknown'
})

const playAllUnique = (tracks: ReadonlyArray<QueueTrackType>) => {
  const ids = new Set<string>()
  return tracks.filter((track) => {
    if (ids.has(track.id)) return false
    ids.add(track.id)
    return true
  })
}

const trackFromQueueIndex = (state: typeof initialQueueState, index: number) =>
  state.tracks[index] ?? null

const currentTrack = (state: typeof initialQueueState) => selectQueueView(state).current

export interface AudioPlaybackShape {
  readonly getSnapshot: () => PlaybackSnapshot
  readonly subscribeSnapshot: (listener: SnapshotListener) => () => void
  readonly play: () => Effect.Effect<void>
  readonly pause: Effect.Effect<void>
  readonly togglePlayPause: Effect.Effect<void>
  readonly seekTo: (seconds: number) => Effect.Effect<void>
  readonly seekByPercentage: (percentage: number) => Effect.Effect<void>
  readonly jumpForward: (seconds?: number) => Effect.Effect<void>
  readonly jumpBackward: (seconds?: number) => Effect.Effect<void>
  readonly setVolume: (volume: number) => Effect.Effect<void>
  readonly toggleMute: Effect.Effect<void>
  readonly playTrack: (track: QueueTrackType) => Effect.Effect<void>
  readonly playAll: (tracks: ReadonlyArray<QueueTrackType>) => Effect.Effect<void>
  readonly enqueue: (track: QueueTrackType) => Effect.Effect<void>
  readonly enqueueAll: (tracks: ReadonlyArray<QueueTrackType>) => Effect.Effect<void>
  readonly removeFromQueue: (index: number) => Effect.Effect<void>
  readonly reorderQueue: (from: number, to: number) => Effect.Effect<void>
  readonly clearQueue: Effect.Effect<void>
  readonly playFromQueue: (index: number) => Effect.Effect<void>
  readonly playNext: Effect.Effect<void>
  readonly playPrevious: Effect.Effect<void>
}

export const makeAudioPlayback = (
  runtime: PlaybackRuntime,
  reporter: AudioPlaybackReporter = noopReporter
): Effect.Effect<AudioPlaybackShape, never, AudioEngine | PlayerStorage | PlayReporter | Scope> =>
  Effect.gen(function* () {
    const engine = yield* AudioEngine
    const storage = yield* PlayerStorage

    const onError =
      reporter.onError ??
      ((message: string, error: unknown) => Effect.sync(() => console.error(message, error)))

    const reportError = (message: string, error: unknown) => onError(message, error)

    let queueState = initialQueueState
    let transportState = initialTransport
    let volumeState = defaultVolume
    const queueHydrationToken = Symbol('queue hydration')
    const volumeHydrationToken = Symbol('volume hydration')
    let queueHydration: { token: symbol; pending: Array<QueueAction> } | null = {
      token: queueHydrationToken,
      pending: []
    }
    let volumeHydration: {
      token: symbol
      pending: VolumeRecordType | null
    } | null = {
      token: volumeHydrationToken,
      pending: null
    }
    let queueWriteTail: Promise<void> = Promise.resolve()
    let volumeWriteTail: Promise<void> = Promise.resolve()
    const listeners = new Set<SnapshotListener>()
    let currentSnapshot = buildSnapshot(queueState, transportState, volumeState)

    const emitSnapshot = () => {
      currentSnapshot = buildSnapshot(queueState, transportState, volumeState)
      for (const listener of listeners) listener(currentSnapshot)
    }

    const persistQueue = (state: typeof initialQueueState) => {
      queueWriteTail = queueWriteTail
        .catch(() => undefined)
        .then(() => runtime.runPromise(storage.saveQueue(state)))
        .catch((error: unknown) => {
          void runtime
            .runPromise(reportError('Unable to persist audio queue', error))
            .catch(() => undefined)
        })
    }

    const persistVolume = (state: VolumeRecordType) => {
      volumeWriteTail = volumeWriteTail
        .catch(() => undefined)
        .then(() => runtime.runPromise(storage.saveVolume(state)))
        .catch((error: unknown) => {
          void runtime
            .runPromise(reportError('Unable to persist audio volume', error))
            .catch(() => undefined)
        })
    }

    const updateTransport = (next: PlaybackTransportSnapshot) => {
      transportState = next
      emitSnapshot()
    }

    const updateQueue = (next: typeof initialQueueState) => {
      queueState = next
      emitSnapshot()
    }

    const updateVolume = (next: VolumeRecordType) => {
      volumeState = next
      emitSnapshot()
    }

    const applyVolumeToEngine = (next: VolumeRecordType) =>
      Effect.gen(function* () {
        yield* engine.setVolume(next.volume / 100)
        yield* engine.setMuted(next.isMuted)
      })

    const syncCurrentTrack = (autoplay: boolean) =>
      Effect.gen(function* () {
        const current = currentTrack(queueState)
        if (!current) {
          yield* core.detachCurrentSource
          yield* core.setSource(null)
          return
        }

        if (autoplay) {
          yield* core.requestPlayOnReady(current.id)
        }
        yield* core.detachCurrentSource
        yield* core.setSource(current)
      })

    const playCurrent = Effect.gen(function* () {
      const current = currentTrack(queueState)
      if (!current) return
      const currentId = yield* core.currentTrackId
      if (currentId !== current.id) {
        yield* syncCurrentTrack(true)
        return
      }
      yield* core.play(current.id)
    })

    const pauseCurrent = Effect.gen(function* () {
      const current = currentTrack(queueState)
      if (!current) return
      yield* (
        reporter.onTrackPaused?.({
          ...queueTrackInfo(current),
          currentTime: currentSnapshot.transport.currentTime,
          duration: currentSnapshot.transport.duration
        }) ?? Effect.void
      )
      yield* core.pause
    })

    const seekCurrent = (seconds: number, method: 'scrub' | 'keyboard' | 'mediasession') =>
      Effect.gen(function* () {
        const current = currentTrack(queueState)
        const fromTime = currentSnapshot.transport.currentTime
        if (current) {
          yield* (
            reporter.onTrackSeek?.({
              trackId: current.id,
              fromTime,
              toTime: seconds,
              method
            }) ?? Effect.void
          )
        }
        yield* core.seekTo(seconds)
      }).pipe(Effect.catchCause((cause) => reportError('Unable to seek audio', cause)))

    const playFromQueue = (index: number, autoplay = true) =>
      Effect.gen(function* () {
        const target = trackFromQueueIndex(queueState, index)
        if (!target) return
        const currentId = yield* core.currentTrackId
        if (currentTrack(queueState)?.id === target.id) {
          if (currentId !== target.id) {
            yield* syncCurrentTrack(autoplay)
            return
          }
          if (autoplay) {
            yield* core.play(target.id)
          }
          return
        }
        yield* core.requestPlayOnReady(target.id)
        yield* core.detachCurrentSource
        const next = reduceQueue(queueState, { _tag: 'playIndex', index })
        updateQueue(next)
        if (queueHydration) queueHydration.pending.push({ _tag: 'playIndex', index })
        else persistQueue(next)
        yield* core.setSource(target)
      })

    const togglePlayPause = Effect.gen(function* () {
      const desired = yield* core.isDesiredPlaying
      if (desired) {
        yield* pauseCurrent
      } else {
        yield* playCurrent
      }
    })

    const playNext = Effect.gen(function* () {
      const currentIndex = queueState.currentIndex
      if (currentIndex < 0) return
      const next = currentIndex + 1
      if (next >= queueState.tracks.length) return
      yield* playFromQueue(next, true)
    })

    const playPrevious = Effect.gen(function* () {
      if (queueState.currentIndex < 0 || queueState.tracks.length === 0) return
      const currentIndex = queueState.currentIndex
      const previous = currentIndex <= 0 ? queueState.tracks.length - 1 : currentIndex - 1
      yield* playFromQueue(previous, true)
    })

    const forkDetached = <A, E>(
      effect: Effect.Effect<A, E, AudioEngine | PlayReporter | PlayerStorage>
    ) => {
      void runtime.runFork(effect.pipe(Effect.catchCause(() => Effect.void)))
    }

    const handleTrackFinished = () => {
      const current = currentTrack(queueState)
      if (!current) return
      const nextIndex = queueState.currentIndex + 1
      const next = trackFromQueueIndex(queueState, nextIndex)
      forkDetached(
        reporter.onTrackCompleted?.({
          ...queueTrackInfo(current),
          duration: currentSnapshot.transport.duration
        }) ?? Effect.void
      )
      if (next) {
        forkDetached(playFromQueue(nextIndex, true))
      }
    }

    const handleStatus = (status: EngineStatus) => {
      updateTransport({
        isInitialized: true,
        isLoaded: status.isLoaded,
        isPlaying: status.playing,
        isBuffering: status.isBuffering,
        currentTime: status.currentTime,
        duration: status.duration
      })
      forkDetached(engine.setPositionState(status.duration, status.currentTime))
    }

    const core = yield* makePlayerCore({
      onStatus: handleStatus,
      onTrackStarted: (track) => {
        forkDetached(reporter.onTrackPlayed?.(track) ?? Effect.void)
      },
      onTrackFinished: handleTrackFinished,
      onError: (message, error) => {
        forkDetached(reportError(message, error))
      }
    })

    updateTransport({ ...transportState, isInitialized: true })

    const loadQueue = Effect.gen(function* () {
      const persisted = yield* storage
        .loadQueue()
        .pipe(
          Effect.catchCause((cause) =>
            reportError('Unable to hydrate audio queue', cause).pipe(Effect.as(null))
          )
        )
      if (queueHydration?.token !== queueHydrationToken) return
      // No Effect yield here: merge, clear hydration, and publish are one
      // cooperatively atomic step.
      const next = mergeHydratedQueue(persisted ?? initialQueueState, queueHydration.pending)
      queueHydration = null
      updateQueue(next)
      const currentId = yield* core.currentTrackId
      const nextCurrent = selectQueueView(next).current
      if (nextCurrent?.id !== currentId) {
        yield* core.setSource(nextCurrent)
      }
      if (next !== persisted) persistQueue(next)
    })

    const loadVolume = Effect.gen(function* () {
      const persisted = yield* storage
        .loadVolume()
        .pipe(
          Effect.catchCause((cause) =>
            reportError('Unable to hydrate audio volume', cause).pipe(Effect.as(null))
          )
        )
      if (volumeHydration?.token !== volumeHydrationToken) return
      const next = volumeHydration.pending ?? persisted ?? defaultVolume
      volumeHydration = null
      updateVolume(next)
      yield* applyVolumeToEngine(next)
      if (next !== persisted) persistVolume(next)
    })

    yield* Effect.forkScoped(loadQueue)
    yield* Effect.forkScoped(loadVolume)

    yield* Effect.addFinalizer(() =>
      Effect.promise(() =>
        Promise.allSettled([queueWriteTail, volumeWriteTail]).then(() => undefined)
      )
    )

    yield* engine.setCommandHandlers({
      onPlay: () => {
        forkDetached(playCurrent)
      },
      onPause: () => {
        forkDetached(pauseCurrent)
      },
      onSeekBackward: (offset) => {
        forkDetached(
          seekCurrent(Math.max(0, currentSnapshot.transport.currentTime - offset), 'mediasession')
        )
      },
      onSeekForward: (offset) => {
        forkDetached(seekCurrent(currentSnapshot.transport.currentTime + offset, 'mediasession'))
      },
      onPreviousTrack: () => {
        forkDetached(playPrevious)
      },
      onNextTrack: () => {
        forkDetached(playNext)
      },
      onSeekTo: (time) => {
        forkDetached(seekCurrent(time, 'mediasession'))
      }
    })

    yield* Effect.addFinalizer(() => engine.setCommandHandlers(null))

    const setVolume = (volume: number) =>
      Effect.gen(function* () {
        const next = { volume: Math.max(0, Math.min(100, volume)), isMuted: volumeState.isMuted }
        updateVolume(next)
        yield* applyVolumeToEngine(next)
        if (volumeHydration) {
          volumeHydration.pending = next
          return
        }
        persistVolume(next)
      })

    const toggleMute = Effect.gen(function* () {
      const next = { ...volumeState, isMuted: !volumeState.isMuted }
      updateVolume(next)
      yield* applyVolumeToEngine(next)
      if (volumeHydration) {
        volumeHydration.pending = next
        return
      }
      persistVolume(next)
    })

    const playTrack = (track: QueueTrackType) =>
      Effect.gen(function* () {
        const current = currentTrack(queueState)
        const currentId = yield* core.currentTrackId
        if (current?.id === track.id) {
          if (currentId === track.id) {
            yield* core.play(track.id)
            return
          }
          yield* syncCurrentTrack(true)
          return
        }
        const next = reduceQueue(queueState, { _tag: 'playNow', track })
        yield* core.requestPlayOnReady(track.id)
        yield* core.detachCurrentSource
        updateQueue(next)
        if (queueHydration) queueHydration.pending.push({ _tag: 'playNow', track })
        else persistQueue(next)
        yield* core.setSource(track)
      })

    const playAll = (tracks: ReadonlyArray<QueueTrackType>) =>
      Effect.gen(function* () {
        const uniqueTracks = playAllUnique(tracks)
        const [first] = uniqueTracks
        if (!first) return
        const next = reduceQueue(queueState, { _tag: 'playAll', tracks: uniqueTracks })
        yield* core.requestPlayOnReady(first.id)
        yield* core.detachCurrentSource
        updateQueue(next)
        if (queueHydration) queueHydration.pending.push({ _tag: 'playAll', tracks: uniqueTracks })
        else persistQueue(next)
        yield* core.setSource(first)
      })

    const enqueue = (track: QueueTrackType) =>
      Effect.gen(function* () {
        const next = reduceQueue(queueState, { _tag: 'enqueue', track })
        if (next === queueState) return
        updateQueue(next)
        if (queueHydration) queueHydration.pending.push({ _tag: 'enqueue', track })
        else persistQueue(next)
        yield* (
          reporter.onQueueAction?.({
            action: 'add',
            trackId: track.id,
            queueLength: queueLength(next)
          }) ?? Effect.void
        )
      })

    const enqueueAll = (tracks: ReadonlyArray<QueueTrackType>) =>
      Effect.gen(function* () {
        const next = reduceQueue(queueState, { _tag: 'enqueueAll', tracks })
        if (next === queueState) return
        updateQueue(next)
        if (queueHydration) queueHydration.pending.push({ _tag: 'enqueueAll', tracks })
        else persistQueue(next)
        yield* (
          reporter.onQueueAction?.({ action: 'add', queueLength: queueLength(next) }) ?? Effect.void
        )
      })

    const reorderQueue = (from: number, to: number) =>
      Effect.gen(function* () {
        const next = reduceQueue(queueState, { _tag: 'reorder', from, to })
        if (next === queueState) return
        updateQueue(next)
        if (queueHydration) queueHydration.pending.push({ _tag: 'reorder', from, to })
        else persistQueue(next)
        yield* (
          reporter.onQueueAction?.({ action: 'reorder', queueLength: queueLength(next) }) ??
            Effect.void
        )
      })

    const removeFromQueue = (index: number) =>
      Effect.gen(function* () {
        if (index < 0 || index >= queueState.tracks.length) return
        const previousCurrentId = currentTrack(queueState)?.id ?? null
        const removed = queueState.tracks[index]
        const next = reduceQueue(queueState, { _tag: 'remove', index })
        const nextCurrent = selectQueueView(next).current
        const nextCurrentId = nextCurrent?.id ?? null
        const shouldAutoplay = previousCurrentId === removed?.id && (yield* core.isDesiredPlaying)
        updateQueue(next)
        if (queueHydration) queueHydration.pending.push({ _tag: 'remove', index })
        else persistQueue(next)
        yield* (
          reporter.onQueueAction?.({
            action: 'remove',
            trackId: removed?.id,
            queueLength: queueLength(next)
          }) ?? Effect.void
        )
        if (previousCurrentId === nextCurrentId) return
        if (nextCurrent) {
          if (shouldAutoplay) {
            yield* core.requestPlayOnReady(nextCurrent.id)
          }
          yield* core.detachCurrentSource
          yield* core.setSource(nextCurrent)
          return
        }
        yield* core.detachCurrentSource
        yield* core.setSource(null)
      })

    const clearQueue = Effect.gen(function* () {
      updateQueue(initialQueueState)
      if (queueHydration) queueHydration.pending.push({ _tag: 'clear' })
      else persistQueue(initialQueueState)
      yield* reporter.onQueueAction?.({ action: 'clear', queueLength: 0 }) ?? Effect.void
      yield* core.detachCurrentSource
      yield* core.setSource(null)
    })

    const playFromQueueIntent = (index: number) =>
      Effect.gen(function* () {
        const target = queueState.tracks[index]
        if (!target) return
        yield* (
          reporter.onQueueAction?.({
            action: 'play_from',
            trackId: target.id,
            queueLength: queueLength(queueState)
          }) ?? Effect.void
        )
        yield* playFromQueue(index, true)
      })

    const subscribeSnapshot = (listener: SnapshotListener) => {
      listeners.add(listener)
      listener(currentSnapshot)
      return () => listeners.delete(listener)
    }

    return {
      getSnapshot: () => currentSnapshot,
      subscribeSnapshot,
      play: () => playCurrent,
      pause: pauseCurrent,
      togglePlayPause,
      seekTo: (seconds) => seekCurrent(seconds, 'scrub'),
      seekByPercentage: (percentage) =>
        Effect.gen(function* () {
          if (
            currentSnapshot.transport.duration <= 0 ||
            !Number.isFinite(currentSnapshot.transport.duration)
          )
            return
          const clamped = Math.max(0, Math.min(100, percentage))
          yield* seekCurrent((clamped / 100) * currentSnapshot.transport.duration, 'scrub')
        }),
      jumpForward: (seconds = 30) =>
        seekCurrent(currentSnapshot.transport.currentTime + seconds, 'keyboard'),
      jumpBackward: (seconds = 15) =>
        seekCurrent(Math.max(0, currentSnapshot.transport.currentTime - seconds), 'keyboard'),
      setVolume,
      toggleMute,
      playTrack,
      playAll,
      enqueue,
      enqueueAll,
      removeFromQueue,
      reorderQueue,
      clearQueue,
      playFromQueue: playFromQueueIntent,
      playNext,
      playPrevious
    }
  })
