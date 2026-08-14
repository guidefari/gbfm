import {
  AudioEngine,
  makeAudioPlayback,
  PlayReporter,
  PlayerStorage,
  type QueueTrackType
} from '@gbfm/player'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { Effect, Layer, ManagedRuntime, Option, Schema } from 'effect'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren
} from 'react'
import { MediaSessionServiceLayer } from '@/services/media-session'
import { PlayerStorageLive } from './storage'
import { playbackAtom, visibilityAtom } from './atoms'
import { HtmlAudioEngineLayer } from './htmlAudioEngine'
import {
  trackAudioCompleted,
  trackAudioError,
  trackAudioPaused,
  trackAudioPlayed,
  trackAudioQueueAction,
  trackAudioSeek
} from './playerAnalytics'
import { persistFullscreenVisibility } from './visibilityStorage'
import { PlayReporterLive } from './playTracker'

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

type AudioPlayback = Effect.Success<ReturnType<typeof makeAudioPlayback>>

const PlayerActionsContext = createContext<PlayerActions | null>(null)

export const usePlayerActions = (): PlayerActions => {
  const actions = use(PlayerActionsContext)
  if (!actions) throw new Error('usePlayerActions must be used within PlayerProvider')
  return actions
}

export const PlayerProvider = ({ children }: PropsWithChildren) => {
  const setPlaybackSnapshot = useAtomSet(playbackAtom)
  const visibility = useAtomValue(visibilityAtom)
  const setVisibility = useAtomSet(visibilityAtom)
  const runtimeRef = useRef<ManagedRuntime.ManagedRuntime<
    AudioEngine | PlayerStorage | PlayReporter,
    never
  > | null>(null)
  const playbackRef = useRef<AudioPlayback | null>(null)

  const runPlayback = useCallback((operation: (playback: AudioPlayback) => Effect.Effect<void>) => {
    const playback = playbackRef.current
    const runtime = runtimeRef.current
    if (!playback || !runtime) return
    runtime.runFork(operation(playback))
  }, [])

  useEffect(() => {
    const audio = new Audio()

    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        HtmlAudioEngineLayer(audio).pipe(Layer.provideMerge(MediaSessionServiceLayer)),
        PlayReporterLive
      ).pipe(Layer.provideMerge(PlayerStorageLive))
    )
    runtimeRef.current = runtime

    runtime.runFork(
      Effect.gen(function* () {
        const playback = yield* makeAudioPlayback(runtime, {
          onTrackPlayed: (track) =>
            Effect.sync(() => {
              trackAudioPlayed({ trackId: track.id, title: track.title, slug: track.slug })
            }),
          onTrackPaused: ({ trackId, title, currentTime, duration }) =>
            Effect.sync(() => {
              trackAudioPaused({ trackId, title, currentTime, duration })
            }),
          onTrackCompleted: ({ trackId, title, duration }) =>
            Effect.sync(() => {
              trackAudioCompleted({ trackId, title, duration })
            }),
          onTrackSeek: ({ trackId, fromTime, toTime, method }) =>
            Effect.sync(() => {
              trackAudioSeek({ trackId, fromTime, toTime, method })
            }),
          onQueueAction: ({ action, trackId, queueLength }) =>
            Effect.sync(() => {
              trackAudioQueueAction({ action, trackId, queueLength })
            }),
          onError: (message, error) =>
            Effect.sync(() => {
              const parsedMessage = Schema.decodeUnknownOption(Schema.String)(error)
              trackAudioError({
                trackId: null,
                title: 'unknown',
                errorMessage:
                  error instanceof Error
                    ? error.message
                    : Option.getOrElse(parsedMessage, () => message)
              })
            })
        })
        playbackRef.current = playback
        const unsubscribe = playback.subscribeSnapshot(setPlaybackSnapshot)
        yield* Effect.addFinalizer(() => Effect.sync(unsubscribe))
        return yield* Effect.never
      }).pipe(Effect.scoped)
    )

    return () => {
      playbackRef.current = null
      runtimeRef.current = null
      audio.pause()
      void runtime.dispose()
    }
  }, [setPlaybackSnapshot])

  const actions = useMemo<PlayerActions>(
    () => ({
      play: () => runPlayback((playback) => playback.play),
      pause: () => runPlayback((playback) => playback.pause),
      togglePlayPause: () => runPlayback((playback) => playback.togglePlayPause),
      seekTo: (time) => runPlayback((playback) => playback.seekTo(time)),
      seekByPercentage: (percentage) =>
        runPlayback((playback) => playback.seekByPercentage(percentage)),
      jumpForward: (seconds) => runPlayback((playback) => playback.jumpForward(seconds)),
      jumpBackward: (seconds) => runPlayback((playback) => playback.jumpBackward(seconds)),
      setVolume: (volume) => runPlayback((playback) => playback.setVolume(volume)),
      toggleMute: () => runPlayback((playback) => playback.toggleMute),
      playTrack: (track) => {
        runPlayback((playback) => playback.playTrack(track))
        persistFullscreenVisibility(true)
        setVisibility((state) => ({ ...state, isFullscreenVisible: true }))
      },
      playAll: (tracks) => {
        runPlayback((playback) => playback.playAll(tracks))
        persistFullscreenVisibility(true)
        setVisibility((state) => ({ ...state, isFullscreenVisible: true }))
      },
      enqueue: (track) => runPlayback((playback) => playback.enqueue(track)),
      enqueueAll: (tracks) => runPlayback((playback) => playback.enqueueAll(tracks)),
      removeFromQueue: (index) => runPlayback((playback) => playback.removeFromQueue(index)),
      reorderQueue: (from, to) => runPlayback((playback) => playback.reorderQueue(from, to)),
      clearQueue: () => runPlayback((playback) => playback.clearQueue),
      playFromQueue: (index) => {
        runPlayback((playback) => playback.playFromQueue(index))
        persistFullscreenVisibility(true)
        setVisibility((state) => ({ ...state, isFullscreenVisible: true }))
      },
      playNext: () => runPlayback((playback) => playback.playNext),
      playPrevious: () => runPlayback((playback) => playback.playPrevious),
      toggleQueue: () =>
        setVisibility((state) => ({
          ...state,
          isQueueVisible: !state.isQueueVisible
        })),
      toggleFullscreen: () => {
        const isFullscreenVisible = !visibility.isFullscreenVisible
        persistFullscreenVisibility(isFullscreenVisible)
        setVisibility((state) => ({ ...state, isFullscreenVisible }))
      },
      closeFullscreen: () => {
        persistFullscreenVisibility(false)
        setVisibility((state) => ({ ...state, isFullscreenVisible: false }))
      }
    }),
    [runPlayback, setVisibility, visibility.isFullscreenVisible]
  )

  return <PlayerActionsContext value={actions}>{children}</PlayerActionsContext>
}
