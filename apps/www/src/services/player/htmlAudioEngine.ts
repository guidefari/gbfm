import {
  AudioEngine,
  PlaybackRejected,
  type EngineStatus,
  type NowPlayingMetadata
} from '@gbfm/player'
import { Effect, Layer, Queue, Stream } from 'effect'
import { log } from '@/services/logger'
import { MediaSessionService } from '@/services/media-session'

/** Narrow browser audio surface the web engine depends on. HTMLAudioElement
 *  satisfies this; tests supply a recording stand-in through the same seam. */
export type HtmlAudioPort = {
  src: string
  currentTime: number
  readonly duration: number
  readonly paused: boolean
  readonly ended: boolean
  readonly readyState: number
  load: () => void
  play: () => Promise<void>
  pause: () => void
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => void
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ) => void
}

const readStatus = (
  audio: HtmlAudioPort,
  didJustFinish: boolean,
  sourceGeneration: number | null
): EngineStatus => ({
  sourceGeneration,
  isLoaded: audio.readyState >= 1,
  playing: !audio.paused && !audio.ended,
  didJustFinish,
  currentTime: audio.currentTime,
  duration: Number.isFinite(audio.duration) ? audio.duration : 0,
  isBuffering: audio.readyState < 3 && !audio.paused
})

const makeHtmlAudioEngine = (audio: HtmlAudioPort) =>
  Effect.gen(function* () {
    const mediaSession = yield* MediaSessionService
    let justFinished = false
    let sourceGeneration: number | null = null

    // DOM listeners are plain callbacks, so mediaSession effects are run
    // detached rather than yielded.
    const runDetached = (effect: Effect.Effect<void>) => {
      Effect.runFork(effect)
    }

    const changes = Stream.callback<EngineStatus>((queue) =>
      Effect.gen(function* () {
        const emit = () => {
          Queue.offerUnsafe(queue, readStatus(audio, justFinished, sourceGeneration))
        }

        const onEnded = () => {
          justFinished = true
          Queue.offerUnsafe(queue, readStatus(audio, true, sourceGeneration))
          justFinished = false
        }

        const onPlay = () => {
          justFinished = false
          runDetached(mediaSession.setPlaybackState('playing'))
          emit()
        }

        const onPause = () => {
          runDetached(mediaSession.setPlaybackState('paused'))
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

        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            audio.removeEventListener('timeupdate', emit)
            audio.removeEventListener('loadedmetadata', emit)
            audio.removeEventListener('durationchange', emit)
            audio.removeEventListener('canplay', emit)
            audio.removeEventListener('waiting', emit)
            audio.removeEventListener('play', onPlay)
            audio.removeEventListener('pause', onPause)
            audio.removeEventListener('ended', onEnded)
          })
        )
      })
    )

    return {
      replace: (url: string, generation: number) =>
        Effect.sync(() => {
          justFinished = false
          sourceGeneration = generation
          audio.src = url
          audio.load()
        }),

      // Safari rejects play() when it lands outside a user-gesture stack.
      // The rejection is surfaced so the core can reconcile intent instead of
      // staying stuck at "desired playing" against a paused element.
      play: Effect.suspend(() =>
        Effect.tryPromise({
          try: () => audio.play(),
          catch: (error: unknown) => {
            log('error', 'Unable to start playback', { error })
            return new PlaybackRejected({ cause: error })
          }
        })
      ),

      pause: Effect.sync(() => audio.pause()),

      seekTo: (seconds: number) =>
        Effect.callback<void>((resume) => {
          const apply = () => {
            audio.currentTime = seconds
            resume(Effect.void)
          }
          // Seeking before metadata lands silently no-ops in browsers.
          if (audio.readyState >= 1) apply()
          else audio.addEventListener('loadedmetadata', apply, { once: true })
        }),

      currentStatus: Effect.sync(() => readStatus(audio, justFinished, sourceGeneration)),

      changes,

      setNowPlaying: (metadata: NowPlayingMetadata | null) =>
        metadata === null
          ? mediaSession.setPlaybackState('none')
          : mediaSession.setMetadata(
              metadata.title,
              metadata.artist ? [metadata.artist] : [],
              metadata.artworkUrl
            )
    }
  })

export const HtmlAudioEngineLayer = (audio: HtmlAudioPort) =>
  Layer.effect(AudioEngine, makeHtmlAudioEngine(audio))
