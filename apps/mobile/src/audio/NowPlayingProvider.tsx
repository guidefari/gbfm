import type { AudioResponse } from '@gbfm/api/audio'
import {
  createPlayerCore,
  type EngineStatus,
  type PlayerCore,
  type QueueTrackType
} from '@gbfm/player'
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
import { createExpoAudioEngine } from '@/audio/expoAudioEngine'
import { recordPlayIfFresh } from '@/audio/playTracker'
import { playerStorage } from '@/runtime'
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

  const coreRef = useRef<PlayerCore | null>(null)
  const skipNextRef = useRef<() => void>(() => {})

  useEffect(() => {
    const core = createPlayerCore(createExpoAudioEngine(player), playerStorage, {
      onStatus: setStatus,
      onTrackFinished: () => skipNextRef.current(),
      recordPlay: recordPlayIfFresh
    })
    coreRef.current = core
    return () => {
      core.dispose()
      coreRef.current = null
    }
  }, [player])

  useEffect(() => {
    coreRef.current?.setSource(currentTrack)
  }, [currentTrack])

  const loadAndPlay = useCallback(
    (nextTrack: Track) => {
      const core = coreRef.current
      if (!core) return
      if (currentTrack?.id === nextTrack.id) {
        core.play(nextTrack.id)
        return
      }
      core.requestPlayOnReady(nextTrack.id)
      core.detachCurrentSource()
      dispatch({ _tag: 'playNow', track: toQueueTrack(nextTrack) })
    },
    [currentTrack?.id, dispatch]
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
      const core = coreRef.current
      if (!core || tracks.length === 0) return
      const queued = tracks.map(toQueueTrack)
      const first = queued[0]
      if (!first) return
      core.requestPlayOnReady(first.id)
      core.detachCurrentSource()
      dispatch({ _tag: 'playAll', tracks: queued })
    },
    [dispatch]
  )

  const removeFromQueue = useCallback(
    (index: number) => {
      const core = coreRef.current
      if (!core || index < 0 || index >= queue.tracks.length) return
      if (index === queue.currentIndex) {
        const next = queue.tracks[index + 1] ?? queue.tracks[index - 1]
        if (core.isDesiredPlaying() && next) core.requestPlayOnReady(next.id)
        core.detachCurrentSource()
      }
      dispatch({ _tag: 'remove', index })
    },
    [dispatch, queue.currentIndex, queue.tracks]
  )

  const reorderQueue = useCallback(
    (from: number, to: number) => {
      dispatch({ _tag: 'reorder', from, to })
    },
    [dispatch]
  )

  const skipTo = useCallback(
    (index: number) => {
      const core = coreRef.current
      const target = queue.tracks[index]
      if (!core || !target) return
      if (currentTrack?.id === target.id) {
        core.play(target.id)
        return
      }
      core.requestPlayOnReady(target.id)
      core.detachCurrentSource()
      dispatch({ _tag: 'playIndex', index })
    },
    [currentTrack?.id, dispatch, queue.tracks]
  )

  const skipNext = useCallback(() => {
    if (queue.currentIndex < 0) return
    if (queue.currentIndex + 1 >= queue.tracks.length) return
    skipTo(queue.currentIndex + 1)
  }, [queue.currentIndex, queue.tracks.length, skipTo])

  const skipPrevious = useCallback(() => {
    if (queue.currentIndex < 0) return
    if (queue.currentIndex === 0) {
      coreRef.current?.seekTo(0)
      return
    }
    skipTo(queue.currentIndex - 1)
  }, [queue.currentIndex, skipTo])

  skipNextRef.current = skipNext

  const togglePlayback = useCallback(() => {
    const core = coreRef.current
    if (!core || !currentTrack) return
    if (core.isDesiredPlaying()) core.pause()
    else core.play(currentTrack.id)
  }, [currentTrack])

  const seekTo = useCallback((seconds: number) => {
    coreRef.current?.seekTo(seconds)
  }, [])

  const clearQueue = useCallback(() => {
    coreRef.current?.detachCurrentSource()
    dispatch({ _tag: 'clear' })
  }, [dispatch])

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
