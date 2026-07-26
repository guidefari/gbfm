import {
  AudioEngine,
  PlaybackRejected,
  type EngineStatus,
  type NowPlayingMetadata,
  type PlaybackCommandHandlers
} from '@gbfm/player'
import { Effect, Layer, Queue, Stream } from 'effect'
import type { AudioPlayer, AudioStatus } from 'expo-audio'
import { subscribeToPlaybackStatus } from './audioPlayerAdapter'

const toEngineStatus = (status: AudioStatus, sourceGeneration: number | null): EngineStatus => ({
  sourceGeneration,
  isLoaded: status.isLoaded,
  playing: status.playing,
  didJustFinish: status.didJustFinish,
  currentTime: status.currentTime,
  duration: status.duration,
  isBuffering: status.isBuffering
})

export type ExpoAudioEnginePlayer = Pick<
  AudioPlayer,
  | 'replace'
  | 'play'
  | 'pause'
  | 'seekTo'
  | 'currentStatus'
  | 'volume'
  | 'muted'
  | 'addListener'
  | 'clearLockScreenControls'
  | 'setActiveForLockScreen'
>

const makeExpoAudioEngine = (player: ExpoAudioEnginePlayer, platform: 'native' | 'web') =>
  Effect.sync(() => {
    let sourceGeneration: number | null = null

    return {
      replace: (url: string, generation: number) =>
        Effect.sync(() => {
          sourceGeneration = generation
          player.replace(url)
        }),
      clearSource: Effect.sync(() => {
        sourceGeneration = null
        player.replace(null)
      }),
      play: Effect.try({
        try: () => player.play(),
        catch: (cause: unknown) => new PlaybackRejected({ cause })
      }),
      pause: Effect.sync(() => player.pause()),
      setVolume: (volume: number) =>
        Effect.sync(() => {
          player.volume = Math.max(0, Math.min(1, volume))
        }),
      setMuted: (muted: boolean) =>
        Effect.sync(() => {
          player.muted = muted
        }),
      seekTo: (seconds: number) => Effect.promise(() => player.seekTo(seconds)),
      currentStatus: Effect.sync(() => toEngineStatus(player.currentStatus, sourceGeneration)),

      changes: Stream.callback<EngineStatus>((queue) =>
        Effect.gen(function* () {
          const subscription = subscribeToPlaybackStatus(player, platform, (status) => {
            Queue.offerUnsafe(queue, toEngineStatus(status, sourceGeneration))
          })
          yield* Effect.addFinalizer(() => Effect.sync(() => subscription.remove()))
        })
      ),

      setNowPlaying: (metadata: NowPlayingMetadata | null) =>
        Effect.sync(() => {
          if (!metadata) {
            player.clearLockScreenControls()
            return
          }
          player.setActiveForLockScreen(
            true,
            {
              title: metadata.title,
              artist: metadata.artist,
              artworkUrl: metadata.artworkUrl
            },
            { showSeekForward: true, showSeekBackward: true }
          )
        }),

      setPositionState: () => Effect.void,

      // expo-audio exposes lock-screen activation/metadata but no JS remote
      // next/previous callback surface, so we keep this seam a no-op here.
      setCommandHandlers: (_handlers: PlaybackCommandHandlers | null) => Effect.void
    }
  })

export const ExpoAudioEngineLayer = (player: ExpoAudioEnginePlayer, platform: 'native' | 'web') =>
  Layer.effect(AudioEngine, makeExpoAudioEngine(player, platform))
