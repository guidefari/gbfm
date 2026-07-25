import type { QueueTrackType } from '@gbfm/player'
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
import {
  persistVolume,
  transportAtom,
  useQueue,
  useQueueDispatch,
  visibilityAtom,
  volumeAtom,
  type QueueAction
} from './atoms'
import { createPlayerController, type PlayerController } from './controller'

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
  const dispatchQueue = useQueueDispatch()
  const setTransport = useAtomSet(transportAtom)
  const setVolumeState = useAtomSet(volumeAtom)
  const setVisibility = useAtomSet(visibilityAtom)

  const controllerRef = useRef<PlayerController | null>(null)
  const queueRef = useRef(queue)
  const volumeRef = useRef({ volume: 100, isMuted: false })
  const autoplayRef = useRef(false)
  const isPlayingRef = useRef(false)

  queueRef.current = queue

  const playIndex = useCallback(
    (index: number) => {
      autoplayRef.current = true
      dispatchQueue({ _tag: 'playIndex', index })
    },
    [dispatchQueue]
  )

  const playNext = useCallback(() => {
    const { tracks, currentIndex } = queueRef.current
    if (currentIndex < 0 || currentIndex >= tracks.length - 1) return
    playIndex(currentIndex + 1)
  }, [playIndex])

  const playPrevious = useCallback(() => {
    const { tracks, currentIndex } = queueRef.current
    if (tracks.length === 0) return
    playIndex(currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1)
  }, [playIndex])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const audio = new Audio()
    const controller = createPlayerController(audio, {
      setTransport: (update) =>
        setTransport((state) => {
          const next = update(state)
          isPlayingRef.current = next.isPlaying
          return next
        }),
      playNext,
      playPrevious,
      getVolume: () => volumeRef.current,
      getCurrentTrack: () => {
        const { tracks, currentIndex } = queueRef.current
        return currentIndex >= 0 ? (tracks[currentIndex] ?? null) : null
      }
    })

    controllerRef.current = controller
    setTransport((state) => ({ ...state, isInitialized: true }))

    return () => {
      controller.dispose()
      controllerRef.current = null
      setTransport((state) => ({ ...state, isInitialized: false }))
    }
  }, [playNext, playPrevious, setTransport])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller) return
    if (!queue.current) return

    controller.loadTrack(queue.current, { autoplay: autoplayRef.current })
    autoplayRef.current = false
  }, [queue.current?.id, queue.current])

  const actions = useMemo<PlayerActions>(() => {
    const withController = (fn: (controller: PlayerController) => void) => () => {
      const controller = controllerRef.current
      if (controller) fn(controller)
    }

    const dispatchAndPlay = (action: QueueAction) => {
      autoplayRef.current = true
      dispatchQueue(action)
    }

    return {
      play: withController((controller) => controller.play()),
      pause: withController((controller) => controller.pause()),
      togglePlayPause: () => {
        const controller = controllerRef.current
        if (!controller) return
        if (isPlayingRef.current) controller.pause()
        else controller.play()
      },
      seekTo: (time) => controllerRef.current?.seekTo(time),
      seekByPercentage: (percentage) => {
        const controller = controllerRef.current
        if (!controller) return
        setTransport((state) => {
          controller.seekTo((percentage / 100) * state.duration)
          return state
        })
      },
      jumpForward: (seconds = 30) => controllerRef.current?.seekBy(seconds),
      jumpBackward: (seconds = 15) => controllerRef.current?.seekBy(-seconds),

      setVolume: (volume) => {
        const clamped = Math.max(0, Math.min(100, volume))
        setVolumeState((state) => {
          const next = { ...state, volume: clamped }
          volumeRef.current = next
          persistVolume(next)
          return next
        })
        controllerRef.current?.applyVolume()
      },
      toggleMute: () => {
        setVolumeState((state) => {
          const next = { ...state, isMuted: !state.isMuted }
          volumeRef.current = next
          persistVolume(next)
          return next
        })
        controllerRef.current?.applyVolume()
      },

      playTrack: (track) => dispatchAndPlay({ _tag: 'playNow', track }),
      playAll: (tracks) => dispatchAndPlay({ _tag: 'playAll', tracks }),
      enqueue: (track) => dispatchQueue({ _tag: 'enqueue', track }),
      enqueueAll: (tracks) => dispatchQueue({ _tag: 'enqueueAll', tracks }),
      removeFromQueue: (index) => dispatchQueue({ _tag: 'remove', index }),
      reorderQueue: (from, to) => dispatchQueue({ _tag: 'reorder', from, to }),
      clearQueue: () => dispatchQueue({ _tag: 'clear' }),
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
    setTransport,
    setVisibility,
    setVolumeState
  ])

  return <PlayerActionsContext value={actions}>{children}</PlayerActionsContext>
}
