import {
  makePlayerCore,
  type EngineStatus,
  type PlayerCoreShape,
  type QueueTrackType
} from '@gbfm/player'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren
} from 'react'
import { MediaSessionServiceLive } from '@/services/media-session'
import { PlayerStorageLive } from './storage'
import {
  persistVolume,
  previewSrcAtom,
  readStoredVolume,
  transportAtom,
  useQueue,
  useQueueDispatch,
  visibilityAtom,
  volumeAtom,
  type QueueAction
} from './atoms'
import {
  resolveNextIndex,
  resolvePreviousIndex,
  resolveSeekTarget,
  resolveVolume
} from './decisions'
import { HtmlAudioEngineLayer } from './htmlAudioEngine'
import { PlayReporterLive } from './playTracker'
import { persistFullscreenVisibility } from './visibilityStorage'

type PlayerActions = {
  readonly play: () => void
  readonly pause: () => void
  readonly togglePlayPause: () => void
  readonly seekTo: (time: number) => void
  readonly seekByPercentage: (percentage: number) => void
  readonly jumpForward: (seconds?: number) => void
  readonly jumpBackward: (seconds?: number) => void
  readonly setVolume: (volume: number) => void
  readonly toggleMute: () => void
  readonly playTrack: (track: QueueTrackType) => void
  readonly playAll: (tracks: ReadonlyArray<QueueTrackType>) => void
  readonly playPreview: (src: string) => void
  readonly enqueue: (track: QueueTrackType) => void
  readonly enqueueAll: (tracks: ReadonlyArray<QueueTrackType>) => void
  readonly removeFromQueue: (index: number) => void
  readonly reorderQueue: (from: number, to: number) => void
  readonly clearQueue: () => void
  readonly playFromQueue: (index: number) => void
  readonly playNext: () => void
  readonly playPrevious: () => void
  readonly toggleQueue: () => void
  readonly toggleFullscreen: () => void
  readonly closeFullscreen: () => void
}

const PlayerActionsContext = createContext<PlayerActions | null>(null)

export const usePlayerActions = (): PlayerActions => {
  const actions = use(PlayerActionsContext)
  if (!actions) throw new Error('usePlayerActions must be used within PlayerProvider')
  return actions
}

export const PlayerProvider = ({ children }: PropsWithChildren) => {
  const queue = useQueue()
  const currentTrack = queue.current
  const dispatchQueue = useQueueDispatch()
  const setTransport = useAtomSet(transportAtom)
  const setVolumeState = useAtomSet(volumeAtom)
  const setVisibility = useAtomSet(visibilityAtom)
  const visibility = useAtomValue(visibilityAtom)
  const setPreviewSrc = useAtomSet(previewSrcAtom)

  const coreRef = useRef<PlayerCoreShape | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const runtimeRef = useRef<ManagedRuntime.ManagedRuntime<never, never> | null>(null)
  const queueRef = useRef(queue)
  // Seeded from the same stored value as volumeAtom so a restored mute or
  // reduced volume is applied to the element, not just shown in the UI.
  const volumeRef = useRef(readStoredVolume())
  const durationRef = useRef(0)
  const playNextRef = useRef<() => void>(() => {})
  const visibilityRef = useRef(visibility)

  queueRef.current = queue
  visibilityRef.current = visibility

  /** Runs a core operation on the mount's runtime. No-ops before the core is
   *  built or after unmount, matching the previous null-ref guards. */
  const runCore = useCallback((operation: (core: PlayerCoreShape) => Effect.Effect<void>) => {
    const core = coreRef.current
    const runtime = runtimeRef.current
    if (!core || !runtime) return
    runtime.runFork(operation(core))
  }, [])

  const onStatus = useCallback(
    (status: EngineStatus) => {
      durationRef.current = status.duration
      setTransport((state) => ({
        ...state,
        isPlaying: status.playing,
        currentTime: status.currentTime,
        duration: status.duration
      }))
    },
    [setTransport]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const audio = new Audio()
    audio.volume = resolveVolume(volumeRef.current.volume, volumeRef.current.isMuted)
    audioRef.current = audio

    // The engine is owned by this mount, so its layer and the core's status
    // fiber live in a runtime scoped to the same lifetime.
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(HtmlAudioEngineLayer(audio), PlayReporterLive).pipe(
        Layer.provideMerge(Layer.mergeAll(PlayerStorageLive, MediaSessionServiceLive))
      )
    )
    runtimeRef.current = runtime

    // The core only observes the engine while a queue track is loaded, so keep
    // a direct listener to drive transport during previews too.
    const onPreviewStatus = () => {
      if (queueRef.current.current) return
      onStatus({
        isLoaded: audio.readyState >= 1,
        playing: !audio.paused && !audio.ended,
        didJustFinish: audio.ended,
        currentTime: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        isBuffering: audio.readyState < 3 && !audio.paused
      })
    }
    audio.addEventListener('timeupdate', onPreviewStatus)
    audio.addEventListener('loadedmetadata', onPreviewStatus)
    audio.addEventListener('play', onPreviewStatus)
    audio.addEventListener('pause', onPreviewStatus)
    audio.addEventListener('ended', onPreviewStatus)

    runtime.runFork(
      Effect.gen(function* () {
        const core = yield* makePlayerCore({
          onStatus,
          onTrackFinished: () => playNextRef.current()
        })
        coreRef.current = core
        setTransport((state) => ({ ...state, isInitialized: true }))
        // Hold the scope open so the core's status fiber keeps running until
        // the runtime is disposed on unmount.
        yield* Effect.never
      }).pipe(Effect.scoped)
    )

    return () => {
      audio.removeEventListener('timeupdate', onPreviewStatus)
      audio.removeEventListener('loadedmetadata', onPreviewStatus)
      audio.removeEventListener('play', onPreviewStatus)
      audio.removeEventListener('pause', onPreviewStatus)
      audio.removeEventListener('ended', onPreviewStatus)
      coreRef.current = null
      audioRef.current = null
      runtimeRef.current = null
      void runtime.dispose()
      audio.pause()
      setTransport((state) => ({ ...state, isInitialized: false }))
    }
  }, [onStatus, setTransport])

  useEffect(() => {
    // Runs for null too, so clearing or removing the last track tears the
    // source down instead of leaving a detached element playing.
    if (currentTrack) setPreviewSrc(null)
    runCore((core) => core.setSource(currentTrack))
  }, [currentTrack, runCore, setPreviewSrc])

  const playIndex = useCallback(
    (index: number) => {
      const target = queueRef.current.tracks[index]
      if (!target) return
      if (queueRef.current.current?.id === target.id) {
        runCore((core) => core.play(target.id))
        return
      }

      runCore((core) =>
        core.requestPlayOnReady(target.id).pipe(Effect.andThen(core.detachCurrentSource))
      )
      dispatchQueue({ _tag: 'playIndex', index })
    },
    [dispatchQueue, runCore]
  )

  const playNext = useCallback(() => {
    const { tracks, currentIndex } = queueRef.current
    const next = resolveNextIndex({ trackCount: tracks.length, currentIndex })
    if (next === null) return
    playIndex(next)
  }, [playIndex])

  const playPrevious = useCallback(() => {
    const { tracks, currentIndex } = queueRef.current
    const previous = resolvePreviousIndex({ trackCount: tracks.length, currentIndex })
    if (previous === null) return
    playIndex(previous)
  }, [playIndex])

  playNextRef.current = playNext

  const actions = useMemo<PlayerActions>(() => {
    const startQueueAction = (action: QueueAction, firstId: string) => {
      runCore((core) =>
        core.requestPlayOnReady(firstId).pipe(Effect.andThen(core.detachCurrentSource))
      )
      dispatchQueue(action)
    }

    const applyVolume = () => {
      const audio = audioRef.current
      if (!audio) return
      audio.volume = resolveVolume(volumeRef.current.volume, volumeRef.current.isMuted)
    }

    return {
      play: () => {
        const current = queueRef.current.current
        if (current) runCore((core) => core.play(current.id))
        // A preview has no queue session, so drive the element directly.
        else void audioRef.current?.play().catch(() => undefined)
      },
      pause: () => {
        if (queueRef.current.current) runCore((core) => core.pause)
        else audioRef.current?.pause()
      },
      togglePlayPause: () => {
        const current = queueRef.current.current
        if (!current) return
        runCore((core) =>
          Effect.flatMap(core.isDesiredPlaying, (desired) =>
            desired ? core.pause : core.play(current.id)
          )
        )
      },
      seekTo: (time) => runCore((core) => core.seekTo(time)),
      seekByPercentage: (percentage) =>
        runCore((core) => core.seekTo(resolveSeekTarget(percentage, durationRef.current))),
      jumpForward: (seconds = 30) => {
        const audio = audioRef.current
        if (audio) runCore((core) => core.seekTo(audio.currentTime + seconds))
      },
      jumpBackward: (seconds = 15) => {
        const audio = audioRef.current
        if (audio) runCore((core) => core.seekTo(Math.max(0, audio.currentTime - seconds)))
      },

      setVolume: (volume) => {
        const clamped = Math.max(0, Math.min(100, volume))
        setVolumeState((state) => {
          const next = { ...state, volume: clamped }
          volumeRef.current = next
          persistVolume(next)
          return next
        })
        applyVolume()
      },
      toggleMute: () => {
        setVolumeState((state) => {
          const next = { ...state, isMuted: !state.isMuted }
          volumeRef.current = next
          persistVolume(next)
          return next
        })
        applyVolume()
      },

      playTrack: (track) => {
        if (queueRef.current.current?.id === track.id) {
          runCore((core) => core.play(track.id))
          return
        }
        startQueueAction({ _tag: 'playNow', track }, track.id)
      },
      playAll: (tracks) => {
        const [first] = tracks
        if (!first) return
        startQueueAction({ _tag: 'playAll', tracks }, first.id)
      },
      /** Plays a source with no gbfm audio record (e.g. a Spotify preview).
       *  Bypasses the queue, so position and play tracking do not apply. */
      playPreview: (src) => {
        const audio = audioRef.current
        if (!audio) return
        runCore((core) => core.setSource(null))
        setPreviewSrc(src)
        audio.src = src
        void audio.play().catch(() => undefined)
      },

      enqueue: (track) => dispatchQueue({ _tag: 'enqueue', track }),
      enqueueAll: (tracks) => dispatchQueue({ _tag: 'enqueueAll', tracks }),
      removeFromQueue: (index) => {
        const { tracks, currentIndex } = queueRef.current
        if (index < 0 || index >= tracks.length) return
        if (index === currentIndex) {
          const next = tracks[index + 1] ?? tracks[index - 1]
          runCore((core) =>
            Effect.flatMap(core.isDesiredPlaying, (desired) =>
              (desired && next ? core.requestPlayOnReady(next.id) : Effect.void).pipe(
                Effect.andThen(core.detachCurrentSource)
              )
            )
          )
        }
        dispatchQueue({ _tag: 'remove', index })
      },
      reorderQueue: (from, to) => dispatchQueue({ _tag: 'reorder', from, to }),
      clearQueue: () => {
        runCore((core) => core.detachCurrentSource)
        dispatchQueue({ _tag: 'clear' })
      },
      playFromQueue: playIndex,
      playNext,
      playPrevious,

      toggleQueue: () =>
        setVisibility((state) => ({ ...state, isQueueVisible: !state.isQueueVisible })),
      toggleFullscreen: () => {
        const isFullscreenVisible = !visibilityRef.current.isFullscreenVisible
        visibilityRef.current = { ...visibilityRef.current, isFullscreenVisible }
        persistFullscreenVisibility(isFullscreenVisible)
        setVisibility((state) => ({ ...state, isFullscreenVisible }))
      },
      closeFullscreen: () => {
        visibilityRef.current = { ...visibilityRef.current, isFullscreenVisible: false }
        persistFullscreenVisibility(false)
        setVisibility((state) => ({ ...state, isFullscreenVisible: false }))
      }
    }
  }, [
    dispatchQueue,
    playIndex,
    playNext,
    playPrevious,
    runCore,
    setPreviewSrc,
    setVisibility,
    setVolumeState
  ])

  return <PlayerActionsContext value={actions}>{children}</PlayerActionsContext>
}
