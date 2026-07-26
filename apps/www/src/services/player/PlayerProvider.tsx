import {
  makePlayerCore,
  AudioEngine,
  PlayReporter,
  PlayerStorage,
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
import { MediaSessionService, MediaSessionServiceLayer } from '@/services/media-session'
import { PlayerStorageLive } from './storage'
import {
  noneSource,
  previewSource,
  queueSource,
  resolvePlayTrackBinding,
  type ActiveSource
} from './activeSource'
import {
  activeSourceAtom,
  persistVolume,
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
import {
  trackAudioCompleted,
  trackAudioError,
  trackAudioPaused,
  trackAudioPlayed,
  trackAudioQueueAction,
  trackAudioSeek
} from './playerAnalytics'
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

type PlayerMountServices = AudioEngine | PlayReporter | PlayerStorage | MediaSessionService

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
  const setActiveSource = useAtomSet(activeSourceAtom)

  const coreRef = useRef<PlayerCoreShape | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const runtimeRef = useRef<ManagedRuntime.ManagedRuntime<PlayerMountServices, never> | null>(null)
  const queueRef = useRef(queue)
  const activeSourceRef = useRef<ActiveSource>(noneSource)
  // Seeded from the same stored value as volumeAtom so a restored mute or
  // reduced volume is applied to the element, not just shown in the UI.
  const volumeRef = useRef(readStoredVolume())
  const durationRef = useRef(0)
  const playNextRef = useRef<() => void>(() => {})
  const actionsRef = useRef<PlayerActions | null>(null)
  const visibilityRef = useRef(visibility)

  queueRef.current = queue
  visibilityRef.current = visibility

  const runCore = useCallback((operation: (core: PlayerCoreShape) => Effect.Effect<void>) => {
    const core = coreRef.current
    const runtime = runtimeRef.current
    if (!core || !runtime) return
    runtime.runFork(operation(core))
  }, [])

  const commitActiveSource = useCallback(
    (source: ActiveSource) => {
      activeSourceRef.current = source
      setActiveSource(source)
    },
    [setActiveSource]
  )

  const onStatus = useCallback(
    (status: EngineStatus) => {
      durationRef.current = status.duration
      setTransport((state) => ({
        ...state,
        isPlaying: status.playing,
        currentTime: status.currentTime,
        duration: status.duration
      }))

      const runtime = runtimeRef.current
      if (!runtime || status.duration <= 0) return
      runtime.runFork(
        Effect.flatMap(MediaSessionService, (media) =>
          media.setPositionState(status.duration, status.currentTime)
        )
      )
    },
    [setTransport]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const audio = new Audio()
    audio.volume = resolveVolume(volumeRef.current.volume, volumeRef.current.isMuted)
    audioRef.current = audio

    const runtime = ManagedRuntime.make(
      Layer.mergeAll(HtmlAudioEngineLayer(audio), PlayReporterLive).pipe(
        Layer.provideMerge(Layer.mergeAll(PlayerStorageLive, MediaSessionServiceLayer))
      )
    )
    runtimeRef.current = runtime

    const onPreviewStatus = () => {
      if (activeSourceRef.current._tag !== 'preview') return
      onStatus({
        sourceGeneration: null,
        isLoaded: audio.readyState >= 1,
        playing: !audio.paused && !audio.ended,
        didJustFinish: audio.ended,
        currentTime: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        isBuffering: audio.readyState < 3 && !audio.paused
      })
      if (audio.ended) {
        commitActiveSource(noneSource)
      }
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
          onTrackFinished: () => {
            const active = activeSourceRef.current
            if (active._tag === 'queue') {
              trackAudioCompleted({
                trackId: active.track.id,
                title: active.track.title,
                duration: durationRef.current
              })
            }
            playNextRef.current()
          },
          onError: (message, error) => {
            const active = activeSourceRef.current
            trackAudioError({
              trackId: active._tag === 'queue' ? active.track.id : null,
              title: active._tag === 'queue' ? active.track.title : 'unknown',
              errorMessage:
                error instanceof Error ? error.message : typeof error === 'string' ? error : message
            })
          }
        })
        coreRef.current = core
        setTransport((state) => ({ ...state, isInitialized: true }))

        const media = yield* MediaSessionService
        yield* media.setActionHandlers({
          onPlay: () => actionsRef.current?.play(),
          onPause: () => actionsRef.current?.pause(),
          onSeekBackward: (offset) => actionsRef.current?.jumpBackward(offset),
          onSeekForward: (offset) => actionsRef.current?.jumpForward(offset),
          onPreviousTrack: () => actionsRef.current?.playPrevious(),
          onNextTrack: () => actionsRef.current?.playNext(),
          onSeekTo: (time) => actionsRef.current?.seekTo(time)
        })
        yield* Effect.addFinalizer(() => media.setActionHandlers(null))

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
      activeSourceRef.current = noneSource
      void runtime.dispose()
      audio.pause()
      setTransport((state) => ({ ...state, isInitialized: false }))
      setActiveSource(noneSource)
    }
  }, [commitActiveSource, onStatus, setActiveSource, setTransport])

  useEffect(() => {
    if (currentTrack) {
      commitActiveSource(queueSource(currentTrack))
      runCore((core) => core.setSource(currentTrack))
      return
    }

    if (activeSourceRef.current._tag === 'queue') {
      commitActiveSource(noneSource)
    }
    runCore((core) => core.setSource(null))
  }, [commitActiveSource, currentTrack, runCore])

  const playIndex = useCallback(
    (index: number) => {
      const target = queueRef.current.tracks[index]
      if (!target) return
      if (
        queueRef.current.current?.id === target.id &&
        activeSourceRef.current._tag === 'queue' &&
        activeSourceRef.current.track.id === target.id
      ) {
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
      const first =
        action._tag === 'playNow'
          ? action.track
          : action._tag === 'playAll'
            ? action.tracks[0]
            : queueRef.current.tracks.find((track) => track.id === firstId)
      if (first) {
        trackAudioPlayed({
          trackId: first.id,
          title: first.title,
          slug: first.slug
        })
      }
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

    const playElement = () => {
      void audioRef.current?.play().catch(() => undefined)
    }

    const pauseElement = () => {
      audioRef.current?.pause()
    }

    const next: PlayerActions = {
      play: () => {
        const active = activeSourceRef.current
        if (active._tag === 'queue') {
          trackAudioPlayed({
            trackId: active.track.id,
            title: active.track.title,
            slug: active.track.slug
          })
          runCore((core) => core.play(active.track.id))
          return
        }
        if (active._tag === 'preview') {
          playElement()
        }
      },
      pause: () => {
        const active = activeSourceRef.current
        if (active._tag === 'queue') {
          trackAudioPaused({
            trackId: active.track.id,
            title: active.track.title,
            currentTime: audioRef.current?.currentTime ?? 0,
            duration: durationRef.current
          })
          runCore((core) => core.pause)
          return
        }
        if (active._tag === 'preview') {
          pauseElement()
        }
      },
      togglePlayPause: () => {
        const active = activeSourceRef.current
        if (active._tag === 'queue') {
          runCore((core) =>
            Effect.flatMap(core.isDesiredPlaying, (desired) => {
              if (desired) {
                trackAudioPaused({
                  trackId: active.track.id,
                  title: active.track.title,
                  currentTime: audioRef.current?.currentTime ?? 0,
                  duration: durationRef.current
                })
                return core.pause
              }
              trackAudioPlayed({
                trackId: active.track.id,
                title: active.track.title,
                slug: active.track.slug
              })
              return core.play(active.track.id)
            })
          )
          return
        }
        if (active._tag === 'preview') {
          const audio = audioRef.current
          if (!audio) return
          if (!audio.paused && !audio.ended) pauseElement()
          else playElement()
        }
      },
      seekTo: (time) => {
        const active = activeSourceRef.current
        const fromTime = audioRef.current?.currentTime ?? 0
        if (active._tag === 'queue') {
          trackAudioSeek({
            trackId: active.track.id,
            fromTime,
            toTime: time,
            method: 'scrub'
          })
          runCore((core) => core.seekTo(time))
          return
        }
        if (active._tag === 'preview' && audioRef.current) {
          audioRef.current.currentTime = time
        }
      },
      seekByPercentage: (percentage) => {
        const target = resolveSeekTarget(percentage, durationRef.current)
        next.seekTo(target)
      },
      jumpForward: (seconds = 30) => {
        const audio = audioRef.current
        if (!audio) return
        next.seekTo(audio.currentTime + seconds)
      },
      jumpBackward: (seconds = 15) => {
        const audio = audioRef.current
        if (!audio) return
        next.seekTo(Math.max(0, audio.currentTime - seconds))
      },

      setVolume: (volume) => {
        const clamped = Math.max(0, Math.min(100, volume))
        setVolumeState((state) => {
          const nextVolume = { ...state, volume: clamped }
          volumeRef.current = nextVolume
          persistVolume(nextVolume)
          return nextVolume
        })
        applyVolume()
      },
      toggleMute: () => {
        setVolumeState((state) => {
          const nextVolume = { ...state, isMuted: !state.isMuted }
          volumeRef.current = nextVolume
          persistVolume(nextVolume)
          return nextVolume
        })
        applyVolume()
      },

      playTrack: (track) => {
        const binding = resolvePlayTrackBinding({
          active: activeSourceRef.current,
          selectedQueueTrack: queueRef.current.current,
          track
        })
        if (binding._tag === 'playExistingSession') {
          runCore((core) => core.play(binding.trackId))
          return
        }
        if (binding._tag === 'rebindQueueSession') {
          commitActiveSource(queueSource(binding.track))
          runCore((core) =>
            core
              .requestPlayOnReady(binding.track.id)
              .pipe(Effect.andThen(core.setSource(binding.track)))
          )
          return
        }
        startQueueAction({ _tag: 'playNow', track: binding.track }, binding.track.id)
      },
      playAll: (tracks) => {
        const [first] = tracks
        if (!first) return
        startQueueAction({ _tag: 'playAll', tracks }, first.id)
      },
      playPreview: (src) => {
        const audio = audioRef.current
        if (!audio) return
        runCore((core) => core.setSource(null))
        commitActiveSource(previewSource(src))
        audio.src = src
        void audio.play().catch(() => undefined)
      },

      enqueue: (track) => {
        dispatchQueue({ _tag: 'enqueue', track })
        trackAudioQueueAction({
          action: 'add',
          trackId: track.id,
          queueLength: queueRef.current.tracks.length + 1
        })
      },
      enqueueAll: (tracks) => {
        dispatchQueue({ _tag: 'enqueueAll', tracks })
        trackAudioQueueAction({
          action: 'add',
          queueLength: queueRef.current.tracks.length + tracks.length
        })
      },
      removeFromQueue: (index) => {
        const { tracks, currentIndex } = queueRef.current
        if (index < 0 || index >= tracks.length) return
        if (index === currentIndex) {
          const nextTrack = tracks[index + 1] ?? tracks[index - 1]
          runCore((core) =>
            Effect.flatMap(core.isDesiredPlaying, (desired) =>
              (desired && nextTrack ? core.requestPlayOnReady(nextTrack.id) : Effect.void).pipe(
                Effect.andThen(core.detachCurrentSource)
              )
            )
          )
        }
        dispatchQueue({ _tag: 'remove', index })
        trackAudioQueueAction({
          action: 'remove',
          trackId: tracks[index]?.id,
          queueLength: Math.max(0, tracks.length - 1)
        })
      },
      reorderQueue: (from, to) => {
        dispatchQueue({ _tag: 'reorder', from, to })
        trackAudioQueueAction({
          action: 'reorder',
          queueLength: queueRef.current.tracks.length
        })
      },
      clearQueue: () => {
        runCore((core) => core.detachCurrentSource)
        dispatchQueue({ _tag: 'clear' })
        trackAudioQueueAction({ action: 'clear', queueLength: 0 })
      },
      playFromQueue: (index) => {
        const target = queueRef.current.tracks[index]
        playIndex(index)
        if (target) {
          trackAudioQueueAction({
            action: 'play_from',
            trackId: target.id,
            queueLength: queueRef.current.tracks.length
          })
        }
      },
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

    return next
  }, [
    commitActiveSource,
    dispatchQueue,
    playIndex,
    playNext,
    playPrevious,
    runCore,
    setVisibility,
    setVolumeState
  ])

  actionsRef.current = actions

  return <PlayerActionsContext value={actions}>{children}</PlayerActionsContext>
}
