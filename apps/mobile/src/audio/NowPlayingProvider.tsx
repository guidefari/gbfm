import type { AudioResponse } from '@gbfm/api/audio'
import type { AudioStatus } from 'expo-audio'
import { useAudioPlayer } from 'expo-audio'
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
import { Platform } from 'react-native'
import { audioModeAtom } from '@/store/atoms/audio-mode'
import { subscribeToPlaybackStatus } from '@/audio/audioPlayerAdapter'
import { clearPosition, recordPlayIfFresh, recordPosition } from '@/audio/playTracker'
import {
  shouldPersistPosition,
  transitionPlaybackIntent,
  transitionSourceCompletion,
  transitionSourcePreparation,
  type PlaybackIntent,
  type SourceCompletion,
  type SourcePreparation,
  type SourcePreparationEvent
} from '@gbfm/player'
import { loadPosition, type QueueTrackType } from '@/audio/queueStorage'
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
  const [status, setStatus] = useState<AudioStatus>(() => player.currentStatus)
  const [queueNotice, setQueueNotice] = useState<QueueNotice | null>(null)

  type SourceSession = {
    readonly generation: number
    readonly id: string
    intent: PlaybackIntent
    preparation: SourcePreparation
    completion: SourceCompletion
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
      session.completion = { ...session.completion, started: true }
      lastPositionPersistRef.current =
        checkpoint === null ? null : { id: session.id, at: checkpoint }
      if (session.intent.desiredPlaying) {
        session.intent = transitionPlaybackIntent(session.intent, {
          _tag: 'command',
          playing: true
        })
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
        session.completion = { ...session.completion, started: true }
        if (session.intent.desiredPlaying) {
          session.intent = transitionPlaybackIntent(session.intent, {
            _tag: 'command',
            playing: true
          })
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
    const current = currentTrack
    const generation = sourceGenerationRef.current + 1
    sourceGenerationRef.current = generation

    if (!current) {
      sourceSessionRef.current = null
      player.clearLockScreenControls()
      player.pause()
      setStatus(player.currentStatus)
      lastPositionPersistRef.current = null
      return
    }

    const session: SourceSession = {
      generation,
      id: current.id,
      intent: {
        desiredPlaying: playOnReadyRef.current === current.id,
        pendingPlaying: null
      },
      preparation: {
        generation,
        sourceLoaded: false,
        checkpointLoaded: false,
        duration: 0,
        preparing: false
      },
      completion: { generation, started: false, handled: false, completed: false },
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

    const observeStatus = (nextStatus: AudioStatus) => {
      if (sourceSessionRef.current !== session) return
      setStatus(nextStatus)
      advancePreparationRef.current(session, {
        _tag: 'sourceStatus',
        generation: session.generation,
        isLoaded: nextStatus.isLoaded,
        duration: nextStatus.duration
      })
      if (!nextStatus.isLoaded) return

      const completion = transitionSourceCompletion(session.completion, {
        generation: session.generation,
        didJustFinish: nextStatus.didJustFinish,
        playing: nextStatus.playing
      })
      session.completion = completion.state
      if (completion.shouldFinish) {
        session.intent = transitionPlaybackIntent(session.intent, { _tag: 'completed' })
        reportEffect('Unable to clear completed audio position', clearPosition(session.id))
        skipNextRef.current()
        return
      }

      if (session.started) {
        session.intent = transitionPlaybackIntent(session.intent, {
          _tag: 'status',
          playing: nextStatus.playing
        })
      }

      const last = lastPositionPersistRef.current
      const previousPosition = last?.id === session.id ? last.at : null
      if (!shouldPersistPosition(session.started, previousPosition, nextStatus.currentTime)) return
      lastPositionPersistRef.current = { id: session.id, at: nextStatus.currentTime }
      reportEffect(
        'Unable to persist audio position',
        recordPosition(session.id, nextStatus.currentTime)
      )
    }

    const subscription = subscribeToPlaybackStatus(
      player,
      Platform.OS === 'web' ? 'web' : 'native',
      observeStatus
    )
    observeStatus(player.currentStatus)

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

    return () => subscription.remove()
  }, [currentTrack, player, reportEffect])

  const playCurrent = useCallback(
    (trackId: string) => {
      const session = sourceSessionRef.current
      if (!session || session.id !== trackId) return
      session.intent = transitionPlaybackIntent(session.intent, {
        _tag: 'command',
        playing: true
      })
      if (!session.started) return

      const play = () => {
        if (sourceSessionRef.current !== session || !session.intent.desiredPlaying) return
        player.play()
        reportEffect('Unable to deliver audio play', recordPlayIfFresh(trackId))
      }
      if (session.completion.completed) {
        player
          .seekTo(0)
          .then(play, (error: unknown) => console.error('Unable to restart completed audio', error))
      } else {
        play()
      }
    },
    [player, reportEffect]
  )

  const loadAndPlay = useCallback(
    (nextTrack: Track) => {
      if (currentTrack?.id === nextTrack.id) {
        playCurrent(nextTrack.id)
        return
      }
      playOnReadyRef.current = nextTrack.id
      const previous = sourceSessionRef.current
      if (previous) {
        previous.completion = { ...previous.completion, handled: true, completed: false }
      }
      dispatch({ _tag: 'playNow', track: toQueueTrack(nextTrack) })
    },
    [currentTrack?.id, dispatch, playCurrent]
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
      playOnReadyRef.current = first.id
      const previous = sourceSessionRef.current
      if (previous) {
        previous.completion = { ...previous.completion, handled: true, completed: false }
      }
      dispatch({ _tag: 'playAll', tracks: queued })
    },
    [dispatch]
  )

  const removeFromQueue = useCallback(
    (index: number) => {
      if (index < 0 || index >= queue.tracks.length) return
      if (index === queue.currentIndex) {
        const session = sourceSessionRef.current
        const shouldContinue = session?.intent.desiredPlaying === true
        const next = queue.tracks[index + 1] ?? queue.tracks[index - 1]
        if (shouldContinue && next) playOnReadyRef.current = next.id
        if (session) {
          session.completion = { ...session.completion, handled: true, completed: false }
        }
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
      const target = queue.tracks[index]
      if (!target) return
      if (currentTrack?.id === target.id) {
        playCurrent(target.id)
        return
      }
      playOnReadyRef.current = target.id
      const previous = sourceSessionRef.current
      if (previous) {
        previous.completion = { ...previous.completion, handled: true, completed: false }
      }
      dispatch({ _tag: 'playIndex', index })
    },
    [currentTrack?.id, dispatch, playCurrent, queue.tracks]
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
    const session = sourceSessionRef.current
    if (!session || !currentTrack) return
    if (playOnReadyRef.current !== null || session.intent.desiredPlaying) {
      playOnReadyRef.current = null
      session.intent = transitionPlaybackIntent(session.intent, {
        _tag: 'command',
        playing: false
      })
      player.pause()
      return
    }
    playCurrent(currentTrack.id)
  }, [currentTrack, playCurrent, player])

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
    const previous = sourceSessionRef.current
    if (previous) {
      previous.completion = { ...previous.completion, handled: true, completed: false }
    }
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
