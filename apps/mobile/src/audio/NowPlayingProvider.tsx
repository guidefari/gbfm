import type { AudioResponse } from '@gbfm/api/audio'
import {
  makePlayerCore,
  type EngineStatus,
  type PlayerCoreShape,
  type QueueTrackType
} from '@gbfm/player'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { useAudioPlayer } from 'expo-audio'
import { useAtomValue } from '@effect/atom-react'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { audioModeAtom } from '@/store/atoms/audio-mode'
import { ExpoAudioEngineLayer } from '@/audio/expoAudioEngine'
import { PlayReporterLive } from '@/audio/playTracker'
import { PlayerStorageLive } from '@/audio/queueStorage'
import type { QueueView } from '@/audio/queueAtom'
import { useQueue, useQueueDispatch } from '@/audio/queueAtom'

type Track = typeof AudioResponse.Type

type QueueNotice = {
  readonly id: number
  readonly message: string
}

type NowPlayingContextValue = {
  readonly track: QueueTrackType | null
  readonly isPlaying: boolean
  readonly isLoaded: boolean
  readonly isBuffering: boolean
  readonly currentTime: number
  readonly duration: number
  readonly queue: QueueView
  readonly queueNotice: QueueNotice | null
  readonly loadAndPlay: (track: Track) => void
  readonly enqueue: (track: Track) => void
  readonly enqueueAll: (tracks: ReadonlyArray<Track>) => void
  readonly playAll: (tracks: ReadonlyArray<Track>) => void
  readonly removeFromQueue: (index: number) => void
  readonly reorderQueue: (from: number, to: number) => void
  readonly skipTo: (index: number) => void
  readonly skipNext: () => void
  readonly skipPrevious: () => void
  readonly togglePlayback: () => void
  readonly seekTo: (seconds: number) => void
  readonly clearQueue: () => void
}

const NowPlayingContext = createContext<NowPlayingContextValue | null>(null)

const toQueueTrack = (track: Track): QueueTrackType => ({
  id: track.id,
  title: track.title,
  slug: track.slug,
  url: track.url,
  thumbnailUrl: track.thumbnailUrl,
  type: track.type,
  creators: track.creators
})

const initialStatus: EngineStatus = {
  isLoaded: false,
  playing: false,
  didJustFinish: false,
  currentTime: 0,
  duration: 0,
  isBuffering: false
}

export function NowPlayingProvider({ children }: PropsWithChildren) {
  useAtomValue(audioModeAtom)

  const queue = useQueue()
  const currentTrack = queue.current
  const dispatch = useQueueDispatch()
  const player = useAudioPlayer(null, { updateInterval: 500, keepAudioSessionActive: true })
  const [status, setStatus] = useState<EngineStatus>(initialStatus)
  const [queueNotice, setQueueNotice] = useState<QueueNotice | null>(null)

  const coreRef = useRef<PlayerCoreShape | null>(null)
  const runtimeRef = useRef<ManagedRuntime.ManagedRuntime<never, never> | null>(null)
  const skipNextRef = useRef<() => void>(() => {})

  /** Runs a core operation on the mount's runtime. No-ops before the core is
   *  built or after unmount. */
  const runCore = useCallback((operation: (core: PlayerCoreShape) => Effect.Effect<void>) => {
    const core = coreRef.current
    const runtime = runtimeRef.current
    if (!core || !runtime) return
    runtime.runFork(operation(core))
  }, [])

  useEffect(() => {
    // The expo player is owned by this mount, so its layer and the core's
    // status fiber live in a runtime scoped to the same lifetime.
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(ExpoAudioEngineLayer(player), PlayReporterLive).pipe(
        Layer.provideMerge(PlayerStorageLive)
      )
    )
    runtimeRef.current = runtime

    runtime.runFork(
      Effect.gen(function* () {
        const core = yield* makePlayerCore({
          onStatus: setStatus,
          onTrackFinished: () => skipNextRef.current()
        })
        coreRef.current = core
        yield* Effect.never
      }).pipe(Effect.scoped)
    )

    return () => {
      coreRef.current = null
      runtimeRef.current = null
      void runtime.dispose()
    }
  }, [player])

  useEffect(() => {
    runCore((core) => core.setSource(currentTrack))
  }, [currentTrack, runCore])

  const loadAndPlay = useCallback(
    (nextTrack: Track) => {
      if (currentTrack?.id === nextTrack.id) {
        runCore((core) => core.play(nextTrack.id))
        return
      }
      runCore((core) =>
        core.requestPlayOnReady(nextTrack.id).pipe(Effect.andThen(core.detachCurrentSource))
      )
      dispatch({ _tag: 'playNow', track: toQueueTrack(nextTrack) })
    },
    [currentTrack?.id, dispatch, runCore]
  )

  const enqueue = useCallback(
    (track: Track) => {
      dispatch({ _tag: 'enqueue', track: toQueueTrack(track) })
      setQueueNotice({ id: Date.now(), message: `Queued: ${track.title}` })
    },
    [dispatch]
  )

  const enqueueAll = useCallback(
    (tracks: ReadonlyArray<Track>) => {
      if (tracks.length === 0) return
      dispatch({ _tag: 'enqueueAll', tracks: tracks.map(toQueueTrack) })
      const [first] = tracks
      const message =
        tracks.length === 1 && first ? `Queued: ${first.title}` : `Queued ${tracks.length} tracks`
      setQueueNotice({ id: Date.now(), message })
    },
    [dispatch]
  )

  const playAll = useCallback(
    (tracks: ReadonlyArray<Track>) => {
      if (tracks.length === 0) return
      const queued = tracks.map(toQueueTrack)
      const first = queued[0]
      if (!first) return
      runCore((core) =>
        core.requestPlayOnReady(first.id).pipe(Effect.andThen(core.detachCurrentSource))
      )
      dispatch({ _tag: 'playAll', tracks: queued })
    },
    [dispatch, runCore]
  )

  const removeFromQueue = useCallback(
    (index: number) => {
      if (index < 0 || index >= queue.tracks.length) return
      if (index === queue.currentIndex) {
        const next = queue.tracks[index + 1] ?? queue.tracks[index - 1]
        runCore((core) =>
          Effect.flatMap(core.isDesiredPlaying, (desired) =>
            (desired && next ? core.requestPlayOnReady(next.id) : Effect.void).pipe(
              Effect.andThen(core.detachCurrentSource)
            )
          )
        )
      }
      dispatch({ _tag: 'remove', index })
    },
    [dispatch, queue.currentIndex, queue.tracks, runCore]
  )

  const reorderQueue = useCallback(
    (from: number, to: number) => {
      dispatch({ _tag: 'reorder', from, to })
    },
    [dispatch]
  )

  const skipTo = useCallback(
    (index: number) => {
      const target = queue.tracks[index]
      if (!target) return
      if (currentTrack?.id === target.id) {
        runCore((core) => core.play(target.id))
        return
      }
      runCore((core) =>
        core.requestPlayOnReady(target.id).pipe(Effect.andThen(core.detachCurrentSource))
      )
      dispatch({ _tag: 'playIndex', index })
    },
    [currentTrack?.id, dispatch, queue.tracks, runCore]
  )

  const skipNext = useCallback(() => {
    if (queue.currentIndex < 0) return
    if (queue.currentIndex + 1 >= queue.tracks.length) return
    skipTo(queue.currentIndex + 1)
  }, [queue.currentIndex, queue.tracks.length, skipTo])

  const skipPrevious = useCallback(() => {
    if (queue.currentIndex < 0) return
    if (queue.currentIndex === 0) {
      runCore((core) => core.seekTo(0))
      return
    }
    skipTo(queue.currentIndex - 1)
  }, [queue.currentIndex, runCore, skipTo])

  skipNextRef.current = skipNext

  const togglePlayback = useCallback(() => {
    if (!currentTrack) return
    runCore((core) =>
      Effect.flatMap(core.isDesiredPlaying, (desired) =>
        desired ? core.pause : core.play(currentTrack.id)
      )
    )
  }, [currentTrack, runCore])

  const seekTo = useCallback(
    (seconds: number) => {
      runCore((core) => core.seekTo(seconds))
    },
    [runCore]
  )

  const clearQueue = useCallback(() => {
    runCore((core) => core.detachCurrentSource)
    dispatch({ _tag: 'clear' })
  }, [dispatch, runCore])

  const value = useMemo<NowPlayingContextValue>(
    () => ({
      track: currentTrack,
      isPlaying: status.playing,
      isLoaded: status.isLoaded,
      isBuffering: status.isBuffering,
      currentTime: status.currentTime,
      duration: status.duration,
      queue,
      queueNotice,
      loadAndPlay,
      enqueue,
      enqueueAll,
      playAll,
      removeFromQueue,
      reorderQueue,
      skipTo,
      skipNext,
      skipPrevious,
      togglePlayback,
      seekTo,
      clearQueue
    }),
    [
      status.playing,
      status.isLoaded,
      status.isBuffering,
      status.currentTime,
      status.duration,
      currentTrack,
      queue,
      queueNotice,
      loadAndPlay,
      enqueue,
      enqueueAll,
      playAll,
      removeFromQueue,
      reorderQueue,
      skipTo,
      skipNext,
      skipPrevious,
      togglePlayback,
      seekTo,
      clearQueue
    ]
  )

  return <NowPlayingContext value={value}>{children}</NowPlayingContext>
}

export function useNowPlaying() {
  const context = useContext(NowPlayingContext)
  if (!context) throw new Error('useNowPlaying must be used within a NowPlayingProvider')
  return context
}
