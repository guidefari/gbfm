import {
  createPlayerCore,
  type EngineStatus,
  type PlayerCore,
  type QueueTrackType
} from '@gbfm/player'
import { useAtomSet } from '@effect/atom-react'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren
} from 'react'
import { playerStorage } from '@/runtime'
import {
  persistVolume,
  previewSrcAtom,
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
import { createHtmlAudioEngine } from './htmlAudioEngine'
import { recordPlayIfFresh } from './playTracker'

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
  const setPreviewSrc = useAtomSet(previewSrcAtom)

  const coreRef = useRef<PlayerCore | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef(queue)
  const volumeRef = useRef({ volume: 100, isMuted: false })
  const durationRef = useRef(0)
  const playNextRef = useRef<() => void>(() => {})

  queueRef.current = queue

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

    const engine = createHtmlAudioEngine(audio)
    const core = createPlayerCore(engine, playerStorage, {
      onStatus,
      onTrackFinished: () => playNextRef.current(),
      recordPlay: recordPlayIfFresh
    })

    // The core only observes the engine while a queue track is loaded, so keep
    // an independent subscription to drive transport during previews too.
    const subscription = engine.subscribe(onStatus)

    coreRef.current = core
    setTransport((state) => ({ ...state, isInitialized: true }))

    return () => {
      subscription.remove()
      core.dispose()
      audio.pause()
      coreRef.current = null
      audioRef.current = null
      setTransport((state) => ({ ...state, isInitialized: false }))
    }
  }, [onStatus, setTransport])

  useEffect(() => {
    if (!currentTrack) return
    setPreviewSrc(null)
    coreRef.current?.setSource(currentTrack)
  }, [currentTrack, setPreviewSrc])

  const playIndex = useCallback(
    (index: number) => {
      const core = coreRef.current
      const target = queueRef.current.tracks[index]
      if (!core || !target) return
      if (queueRef.current.current?.id === target.id) {
        core.play(target.id)
        return
      }
      core.requestPlayOnReady(target.id)
      core.detachCurrentSource()
      dispatchQueue({ _tag: 'playIndex', index })
    },
    [dispatchQueue]
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
      const core = coreRef.current
      if (!core) return
      core.requestPlayOnReady(firstId)
      core.detachCurrentSource()
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
        if (current) coreRef.current?.play(current.id)
        // A preview has no queue session, so drive the element directly.
        else void audioRef.current?.play().catch(() => undefined)
      },
      pause: () => {
        if (queueRef.current.current) coreRef.current?.pause()
        else audioRef.current?.pause()
      },
      togglePlayPause: () => {
        const core = coreRef.current
        const current = queueRef.current.current
        if (!core || !current) return
        if (core.isDesiredPlaying()) core.pause()
        else core.play(current.id)
      },
      seekTo: (time) => coreRef.current?.seekTo(time),
      seekByPercentage: (percentage) =>
        coreRef.current?.seekTo(resolveSeekTarget(percentage, durationRef.current)),
      jumpForward: (seconds = 30) => {
        const audio = audioRef.current
        if (audio) coreRef.current?.seekTo(audio.currentTime + seconds)
      },
      jumpBackward: (seconds = 15) => {
        const audio = audioRef.current
        if (audio) coreRef.current?.seekTo(Math.max(0, audio.currentTime - seconds))
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
          coreRef.current?.play(track.id)
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
        coreRef.current?.setSource(null)
        setPreviewSrc(src)
        audio.src = src
        void audio.play().catch(() => undefined)
      },

      enqueue: (track) => dispatchQueue({ _tag: 'enqueue', track }),
      enqueueAll: (tracks) => dispatchQueue({ _tag: 'enqueueAll', tracks }),
      removeFromQueue: (index) => {
        const core = coreRef.current
        const { tracks, currentIndex } = queueRef.current
        if (!core || index < 0 || index >= tracks.length) return
        if (index === currentIndex) {
          const next = tracks[index + 1] ?? tracks[index - 1]
          if (core.isDesiredPlaying() && next) core.requestPlayOnReady(next.id)
          core.detachCurrentSource()
        }
        dispatchQueue({ _tag: 'remove', index })
      },
      reorderQueue: (from, to) => dispatchQueue({ _tag: 'reorder', from, to }),
      clearQueue: () => {
        coreRef.current?.detachCurrentSource()
        dispatchQueue({ _tag: 'clear' })
      },
      playFromQueue: playIndex,
      playNext,
      playPrevious,

      toggleQueue: () =>
        setVisibility((state) => ({ ...state, isQueueVisible: !state.isQueueVisible })),
      toggleFullscreen: () =>
        setVisibility((state) => ({ ...state, isFullscreenVisible: !state.isFullscreenVisible })),
      closeFullscreen: () => setVisibility((state) => ({ ...state, isFullscreenVisible: false }))
    }
  }, [
    dispatchQueue,
    playIndex,
    playNext,
    playPrevious,
    setPreviewSrc,
    setVisibility,
    setVolumeState
  ])

  return <PlayerActionsContext value={actions}>{children}</PlayerActionsContext>
}
