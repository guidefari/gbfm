import type { AudioEngine, EngineStatus, NowPlayingMetadata } from '@gbfm/player'
import { RuntimeClient } from '@/runtime'
import { log } from '@/services/logger'
import { setMetadata, setPlaybackState } from '@/services/audio-player'

const readStatus = (audio: HTMLAudioElement, didJustFinish: boolean): EngineStatus => ({
  isLoaded: audio.readyState >= 1,
  playing: !audio.paused && !audio.ended,
  didJustFinish,
  currentTime: audio.currentTime,
  duration: Number.isFinite(audio.duration) ? audio.duration : 0,
  isBuffering: audio.readyState < 3 && !audio.paused
})

export const createHtmlAudioEngine = (audio: HTMLAudioElement): AudioEngine => {
  let justFinished = false

  return {
    replace: (url) => {
      justFinished = false
      audio.src = url
      audio.load()
    },

    play: () => {
      void audio.play().catch((error: unknown) => {
        log('error', 'Unable to start playback', { error })
      })
    },

    pause: () => audio.pause(),

    seekTo: (seconds) =>
      new Promise<void>((resolve) => {
        const apply = () => {
          audio.currentTime = seconds
          resolve()
        }
        // Seeking before metadata lands silently no-ops in browsers.
        if (audio.readyState >= 1) apply()
        else audio.addEventListener('loadedmetadata', apply, { once: true })
      }),

    currentStatus: () => readStatus(audio, justFinished),

    subscribe: (listener) => {
      const emit = () => listener(readStatus(audio, justFinished))

      const onEnded = () => {
        justFinished = true
        listener(readStatus(audio, true))
        justFinished = false
      }

      const onPlay = () => {
        justFinished = false
        void RuntimeClient.runPromise(setPlaybackState('playing')).catch(() => undefined)
        emit()
      }

      const onPause = () => {
        void RuntimeClient.runPromise(setPlaybackState('paused')).catch(() => undefined)
        emit()
      }

      audio.addEventListener('timeupdate', emit)
      audio.addEventListener('loadedmetadata', emit)
      audio.addEventListener('durationchange', emit)
      audio.addEventListener('canplay', emit)
      audio.addEventListener('waiting', emit)
      audio.addEventListener('play', onPlay)
      audio.addEventListener('pause', onPause)
      audio.addEventListener('ended', onEnded)

      return {
        remove: () => {
          audio.removeEventListener('timeupdate', emit)
          audio.removeEventListener('loadedmetadata', emit)
          audio.removeEventListener('durationchange', emit)
          audio.removeEventListener('canplay', emit)
          audio.removeEventListener('waiting', emit)
          audio.removeEventListener('play', onPlay)
          audio.removeEventListener('pause', onPause)
          audio.removeEventListener('ended', onEnded)
        }
      }
    },

    setNowPlaying: (metadata: NowPlayingMetadata | null) => {
      if (!metadata) {
        void RuntimeClient.runPromise(setPlaybackState('none')).catch(() => undefined)
        return
      }
      void RuntimeClient.runPromise(
        setMetadata(metadata.title, metadata.artist ? [metadata.artist] : [], metadata.artworkUrl)
      ).catch(() => undefined)
    }
  }
}
