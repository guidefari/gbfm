import type { AudioEngine, EngineStatus } from '@gbfm/player'
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

export const createExpoAudioEngine = (player: AudioPlayer): AudioEngine => ({
  replace: (url) => player.replace(url),
  play: () => player.play(),
  pause: () => player.pause(),
  seekTo: (seconds) => player.seekTo(seconds),
  currentStatus: () => toEngineStatus(player.currentStatus),
  subscribe: (listener) =>
    subscribeToPlaybackStatus(player, Platform.OS === 'web' ? 'web' : 'native', (status) =>
      listener(toEngineStatus(status))
    ),
  setNowPlaying: (metadata) => {
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
  }
})
