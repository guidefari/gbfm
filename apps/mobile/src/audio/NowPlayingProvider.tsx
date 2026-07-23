import type { AudioResponse } from '@gbfm/api/audio'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useAtomValue } from '@effect/atom-react'
import { Effect } from 'effect'
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
import { clearPosition, recordPlayIfFresh, recordPosition } from '@/audio/playTracker'
import { loadPosition, type QueueTrackType } from '@/audio/queueStorage'
import type { QueueAction, QueueView } from '@/audio/queueAtom'
import { useQueue, useQueueDispatch } from '@/audio/queueAtom'

type Track = typeof AudioResponse.Type

type NowPlayingContextValue = {
  readonly track: Track | null
  readonly isPlaying: boolean
  readonly isLoaded: boolean
  readonly isBuffering: boolean
  readonly currentTime: number
  readonly duration: number
  readonly queue: QueueView
  readonly loadAndPlay: (track: Track) => void
  readonly enqueue: (track: Track) => void
  readonly enqueueAll: (tracks: ReadonlyArray<Track>) => void
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

type MetadataSource = Pick<Track, 'title' | 'thumbnailUrl' | 'creators'>

const buildMetadata = (track: MetadataSource) => {
  const artist = track.creators?.map((creator) => creator.name).join(', ') ?? ''
  return {
    title: track.title,
    artist: artist.length > 0 ? artist : undefined,
    artworkUrl: track.thumbnailUrl ?? undefined
  }
}

export function NowPlayingProvider({ children }: PropsWithChildren) {
  useAtomValue(audioModeAtom)

  const queue = useQueue()
  const dispatch = useQueueDispatch()
  const player = useAudioPlayer(null, { updateInterval: 500, keepAudioSessionActive: true })
  const status = useAudioPlayerStatus(player)

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)

  // Two effects: (1) subscribe to the player's native status events, (2) when
  // the queue's current track changes, swap the source + set lock-screen
  // metadata. The listener below owns position persistence + auto-advance so
  // those don't need their own effects.
  const skipNextRef = useRef<() => void>(() => {})
  const seekResumeDoneRef = useRef<string | null>(null)
  const lastPositionPersistRef = useRef<{ id: string; at: number } | null>(null)

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (next) => {
      const id = seekResumeDoneRef.current
      if (!id || !next.isLoaded) return
      if (next.didJustFinish) {
        skipNextRef.current()
        return
      }
      if (!Number.isFinite(next.currentTime) || next.currentTime < 0) return
      const last = lastPositionPersistRef.current
      if (last && last.id === id && next.currentTime - last.at < 1) return
      lastPositionPersistRef.current = { id, at: next.currentTime }
      void Effect.runFork(recordPosition(id, next.currentTime))
    })
    return () => subscription.remove()
  }, [player])

  useEffect(() => {
    const current = queue.current
    if (!current) {
      player.clearLockScreenControls()
      player.pause()
      setCurrentTrack(null)
      seekResumeDoneRef.current = null
      lastPositionPersistRef.current = null
      return
    }
    if (seekResumeDoneRef.current === current.id) return
    seekResumeDoneRef.current = current.id
    lastPositionPersistRef.current = null

    player.replace(current.url)
    player.setActiveForLockScreen(true, buildMetadata(current), {
      showSeekForward: true,
      showSeekBackward: true
    })

    void Effect.runFork(
      Effect.gen(function* () {
        if (status.isLoaded) {
          const saved = yield* loadPosition(current.id)
          if (
            saved &&
            saved.position > 1 &&
            status.duration > 0 &&
            saved.position < status.duration - 5
          ) {
            yield* Effect.promise(() => player.seekTo(saved.position))
          }
          yield* recordPlayIfFresh(current.id)
        }
      })
    )
  }, [queue, player, status.isLoaded, status.duration])

  const loadAndPlay = useCallback(
    (nextTrack: Track) => {
      setCurrentTrack(nextTrack)
      dispatch({ _tag: 'playNow', track: toQueueTrack(nextTrack) })
      player.replace(nextTrack.url)
      player.setActiveForLockScreen(true, buildMetadata(nextTrack), {
        showSeekForward: true,
        showSeekBackward: true
      })
      player.play()
    },
    [dispatch, player]
  )

  const enqueue = useCallback(
    (track: Track) => {
      dispatch({ _tag: 'enqueue', track: toQueueTrack(track) })
    },
    [dispatch]
  )

  const enqueueAll = useCallback(
    (tracks: ReadonlyArray<Track>) => {
      if (tracks.length === 0) return
      dispatch({ _tag: 'enqueueAll', tracks: tracks.map(toQueueTrack) })
    },
    [dispatch]
  )

  const removeFromQueue = useCallback(
    (index: number) => {
      const removed = queue.tracks[index]
      dispatch({ _tag: 'remove', index })
      if (removed && removed.id === seekResumeDoneRef.current) {
        void Effect.runFork(clearPosition(removed.id))
      }
    },
    [dispatch, queue.tracks]
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
      dispatch({ _tag: 'playIndex', index })
      setCurrentTrack(null)
      player.replace(target.url)
      player.setActiveForLockScreen(true, buildMetadata(target), {
        showSeekForward: true,
        showSeekBackward: true
      })
      player.play()
    },
    [dispatch, player, queue.tracks]
  )

  const skipNext = useCallback(() => {
    if (queue.currentIndex < 0) return
    if (queue.currentIndex + 1 >= queue.tracks.length) return
    skipTo(queue.currentIndex + 1)
  }, [queue.currentIndex, queue.tracks.length, skipTo])

  const skipPrevious = useCallback(() => {
    if (queue.currentIndex < 0) return
    if (queue.currentIndex === 0) {
      player.seekTo(0).catch(() => {})
      return
    }
    skipTo(queue.currentIndex - 1)
  }, [queue.currentIndex, player, skipTo])

  skipNextRef.current = skipNext

  const togglePlayback = useCallback(() => {
    if (status.playing) player.pause()
    else player.play()
  }, [player, status.playing])

  const seekTo = useCallback(
    (seconds: number) => {
      player.seekTo(seconds).catch(() => {})
    },
    [player]
  )

  const clearQueue = useCallback(() => {
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
      loadAndPlay,
      enqueue,
      enqueueAll,
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
      currentTrack,
      status.playing,
      status.isLoaded,
      status.isBuffering,
      status.currentTime,
      status.duration,
      queue,
      loadAndPlay,
      enqueue,
      enqueueAll,
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
