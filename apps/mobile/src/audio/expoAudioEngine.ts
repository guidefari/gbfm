import { AudioEngine, type EngineStatus, type NowPlayingMetadata } from '@gbfm/player'
import { Effect, Layer, Queue, Stream } from 'effect'
import type { AudioPlayer, AudioStatus } from 'expo-audio'
import { Platform } from 'react-native'
import { subscribeToPlaybackStatus } from '@/audio/audioPlayerAdapter'

const toEngineStatus = (status: AudioStatus): EngineStatus => ({
  isLoaded: status.isLoaded,
  playing: status.playing,
  didJustFinish: status.didJustFinish,
  currentTime: status.currentTime,
  duration: status.duration,
  isBuffering: status.isBuffering
})

const makeExpoAudioEngine = (player: AudioPlayer) =>
  Effect.sync(() => ({
    replace: (url: string) => Effect.sync(() => player.replace(url)),
    play: Effect.sync(() => player.play()),
    pause: Effect.sync(() => player.pause()),
    seekTo: (seconds: number) => Effect.promise(() => player.seekTo(seconds)),
    currentStatus: Effect.sync(() => toEngineStatus(player.currentStatus)),

    changes: Stream.callback<EngineStatus>((queue) =>
      Effect.gen(function* () {
        const subscription = subscribeToPlaybackStatus(
          player,
          Platform.OS === 'web' ? 'web' : 'native',
          (status) => {
            Queue.offerUnsafe(queue, toEngineStatus(status))
          }
        )
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
      })
  }))

export const ExpoAudioEngineLayer = (player: AudioPlayer) =>
  Layer.effect(AudioEngine, makeExpoAudioEngine(player))
