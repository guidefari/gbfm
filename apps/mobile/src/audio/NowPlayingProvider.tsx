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
  useRef
} from 'react'
import { audioModeAtom } from '@/store/atoms/audio-mode'
import { clearPosition, recordPlayIfFresh, recordPosition } from '@/audio/playTracker'
import {
  shouldPersistPosition,
  transitionSourcePreparation,
  type SourcePreparation,
  type SourcePreparationEvent
} from '@/audio/playbackState'
import { loadPosition, type QueueTrackType } from '@/audio/queueStorage'
import type { QueueAction, QueueView } from '@/audio/queueAtom'
import { useQueue, useQueueDispatch } from '@/audio/queueAtom'

type Track = typeof AudioResponse.Type

type NowPlayingContextValue = {
  readonly track: QueueTrackType | null
  readonly isPlaying: boolean
  readonly isLoaded: boolean
  readonly isBuffering: boolean
  readonly currentTime: number
  readonly duration: number
  readonly queue: QueueView
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
  const currentTrack = queue.current
  const dispatch = useQueueDispatch()
  const player = useAudioPlayer(null, { updateInterval: 500, keepAudioSessionActive: true })
  const status = useAudioPlayerStatus(player)

  type SourceSession = {
    readonly generation: number
    readonly id: string
    shouldPlay: boolean
    preparation: SourcePreparation
    checkpoint: number | null
    started: boolean
  }

  const skipNextRef = useRef<() => void>(() => {})
  const sourceGenerationRef = useRef(0)
  const sourceSessionRef = useRef<SourceSession | null>(null)
  const playOnReadyRef = useRef<string | null>(null)
  const lastPositionPersistRef = useRef<{ id: string; at: number } | null>(null)
  const finishPreparingRef = useRef<(session: SourceSession) => void>(() => {})
  const advancePreparationRef = useRef<
    (session: SourceSession, event: SourcePreparationEvent) => void
  >(() => {})

  const reportEffect = useCallback((label: string, effect: Effect.Effect<void, unknown, never>) => {
    Effect.runPromise(effect).catch((error: unknown) => console.error(label, error))
  }, [])

  finishPreparingRef.current = (session) => {
    if (
      sourceGenerationRef.current !== session.generation ||
      sourceSessionRef.current !== session ||
      !session.preparation.preparing ||
      session.started
    ) {
      return
    }

    const prepare = async () => {
      const checkpoint = session.checkpoint
      if (
        checkpoint !== null &&
        checkpoint > 1 &&
        session.preparation.duration > 0 &&
        checkpoint < session.preparation.duration - 5
      ) {
        await player.seekTo(checkpoint)
      }
      if (
        sourceGenerationRef.current !== session.generation ||
        sourceSessionRef.current !== session
      ) {
        return
      }

      session.started = true
      lastPositionPersistRef.current =
        checkpoint === null ? null : { id: session.id, at: checkpoint }
      if (session.shouldPlay) {
        player.play()
        reportEffect('Unable to deliver audio play', recordPlayIfFresh(session.id))
      }
    }

    prepare().catch((error: unknown) => {
      if (
        sourceGenerationRef.current === session.generation &&
        sourceSessionRef.current === session
      ) {
        session.started = true
        if (session.shouldPlay) {
          player.play()
          reportEffect('Unable to deliver audio play', recordPlayIfFresh(session.id))
        }
      }
      console.error('Unable to restore audio position', error)
    })
  }

  advancePreparationRef.current = (session, event) => {
    const transition = transitionSourcePreparation(session.preparation, event)
    session.preparation = transition.state
    if (transition.shouldPrepare) finishPreparingRef.current(session)
  }

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', () => {
      const session = sourceSessionRef.current
      if (!session) return
      const currentStatus = player.currentStatus
      advancePreparationRef.current(session, {
        _tag: 'sourceStatus',
        generation: session.generation,
        isLoaded: currentStatus.isLoaded,
        duration: currentStatus.duration
      })
      if (!currentStatus.isLoaded) return
      if (currentStatus.didJustFinish) {
        if (session.started) skipNextRef.current()
        return
      }
      const last = lastPositionPersistRef.current
      const previousPosition = last?.id === session.id ? last.at : null
      if (!shouldPersistPosition(session.started, previousPosition, currentStatus.currentTime))
        return
      lastPositionPersistRef.current = { id: session.id, at: currentStatus.currentTime }
      reportEffect(
        'Unable to persist audio position',
        recordPosition(session.id, currentStatus.currentTime)
      )
    })
    return () => subscription.remove()
  }, [player, reportEffect])

  useEffect(() => {
    const current = currentTrack
    const generation = sourceGenerationRef.current + 1
    sourceGenerationRef.current = generation

    if (!current) {
      sourceSessionRef.current = null
      player.clearLockScreenControls()
      player.pause()
      lastPositionPersistRef.current = null
      return
    }

    const session: SourceSession = {
      generation,
      id: current.id,
      shouldPlay: playOnReadyRef.current === current.id,
      preparation: {
        generation,
        sourceLoaded: false,
        checkpointLoaded: false,
        duration: 0,
        preparing: false
      },
      checkpoint: null,
      started: false
    }
    playOnReadyRef.current = null
    sourceSessionRef.current = session
    lastPositionPersistRef.current = null

    // Pausing first prevents Expo Audio's replace() from auto-resuming the old
    // play state before the new source's checkpoint has been restored.
    player.pause()
    player.replace(current.url)
    player.setActiveForLockScreen(true, buildMetadata(current), {
      showSeekForward: true,
      showSeekBackward: true
    })

    Effect.runPromise(loadPosition(current.id)).then(
      (saved) => {
        if (
          sourceGenerationRef.current !== session.generation ||
          sourceSessionRef.current !== session
        ) {
          return
        }
        session.checkpoint = saved?.position ?? null
        advancePreparationRef.current(session, { _tag: 'checkpointLoaded', generation })
      },
      (error: unknown) => {
        if (
          sourceGenerationRef.current !== session.generation ||
          sourceSessionRef.current !== session
        ) {
          return
        }
        advancePreparationRef.current(session, { _tag: 'checkpointLoaded', generation })
        console.error('Unable to load audio position', error)
      }
    )
  }, [currentTrack, player])

  const loadAndPlay = useCallback(
    (nextTrack: Track) => {
      if (currentTrack?.id === nextTrack.id) {
        const session = sourceSessionRef.current
        if (session?.id === nextTrack.id && !session.started) {
          session.shouldPlay = true
          return
        }
        player.play()
        reportEffect('Unable to deliver audio play', recordPlayIfFresh(nextTrack.id))
        return
      }
      playOnReadyRef.current = nextTrack.id
      dispatch({ _tag: 'playNow', track: toQueueTrack(nextTrack) })
    },
    [currentTrack?.id, dispatch, player, reportEffect]
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

  const playAll = useCallback(
    (tracks: ReadonlyArray<Track>) => {
      if (tracks.length === 0) return
      const queued = tracks.map(toQueueTrack)
      const first = queued[0]
      if (!first) return
      playOnReadyRef.current = first.id
      dispatch({ _tag: 'playAll', tracks: queued })
    },
    [dispatch]
  )

  const removeFromQueue = useCallback(
    (index: number) => {
      const removed = queue.tracks[index]
      dispatch({ _tag: 'remove', index })
      if (removed && removed.id === sourceSessionRef.current?.id) {
        reportEffect('Unable to clear audio position', clearPosition(removed.id))
      }
    },
    [dispatch, queue.tracks, reportEffect]
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
        const session = sourceSessionRef.current
        if (session?.id === target.id && !session.started) {
          session.shouldPlay = true
          return
        }
        player.play()
        reportEffect('Unable to deliver audio play', recordPlayIfFresh(target.id))
        return
      }
      playOnReadyRef.current = target.id
      dispatch({ _tag: 'playIndex', index })
    },
    [currentTrack?.id, dispatch, player, queue.tracks, reportEffect]
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
    else {
      const session = sourceSessionRef.current
      if (session && !session.started) {
        session.shouldPlay = true
        return
      }
      player.play()
      if (currentTrack) {
        reportEffect('Unable to deliver audio play', recordPlayIfFresh(currentTrack.id))
      }
    }
  }, [currentTrack, player, reportEffect, status.playing])

  const seekTo = useCallback(
    (seconds: number) => {
      const session = sourceSessionRef.current
      player.seekTo(seconds).then(
        () => {
          if (sourceSessionRef.current !== session || !session?.started) return
          lastPositionPersistRef.current = { id: session.id, at: seconds }
          reportEffect('Unable to persist audio position', recordPosition(session.id, seconds))
        },
        (error: unknown) => console.error('Unable to seek audio', error)
      )
    },
    [player, reportEffect]
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
