import { AudioEngine, PlaybackRejected } from '@gbfm/player'
/* oxlint-disable effecttsgo/strict-effect-provide -- Each test invokes Effect.runPromise, making it an Effect application entry point. */
import { Effect, Fiber, Layer, Stream } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  MediaSessionService,
  type MediaSessionHandlers,
  type MediaSessionServiceContract
} from '@/services/media-session'
import { HtmlAudioEngineLayer, type HtmlAudioPort } from './htmlAudioEngine'

type MediaSessionRecord = {
  readonly metadata: Array<{ title: string; artists: string[]; artwork?: string }>
  readonly playbackStates: Array<'playing' | 'paused' | 'none'>
  readonly positions: Array<{ duration: number; position: number }>
  readonly handlers: Array<MediaSessionHandlers | null>
  clearedMetadata: number
}

const makeRecordingMediaSession = () => {
  const record: MediaSessionRecord = {
    metadata: [],
    playbackStates: [],
    positions: [],
    handlers: [],
    clearedMetadata: 0
  }

  const service: MediaSessionServiceContract = {
    setMetadata: (title, artists, artwork) =>
      Effect.sync(() => {
        record.metadata.push({ title, artists, artwork })
      }),
    clearMetadata: Effect.sync(() => {
      record.clearedMetadata += 1
      record.playbackStates.push('none')
    }),
    setPlaybackState: (state) =>
      Effect.sync(() => {
        record.playbackStates.push(state)
      }),
    setPositionState: (duration, position) =>
      Effect.sync(() => {
        record.positions.push({ duration, position })
      }),
    setActionHandlers: (handlers) =>
      Effect.sync(() => {
        record.handlers.push(handlers)
      })
  }

  return { layer: Layer.succeed(MediaSessionService, service), record }
}

class FakeAudio extends EventTarget implements HtmlAudioPort {
  src = ''
  currentTime = 0
  duration = Number.NaN
  paused = true
  ended = false
  readyState = 0
  volume = 1
  muted = false
  removedListeners: string[] = []
  private shouldRejectPlay = false

  load() {
    this.readyState = 0
    this.paused = true
    this.ended = false
  }

  play(): Promise<void> {
    if (this.shouldRejectPlay) {
      return Promise.reject(new DOMException('NotAllowedError', 'NotAllowedError'))
    }
    this.paused = false
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  }

  pause() {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }

  rejectNextPlay() {
    this.shouldRejectPlay = true
  }

  markLoaded(duration = 120) {
    this.readyState = 4
    this.duration = duration
    this.dispatchEvent(new Event('loadedmetadata'))
  }

  markEnded() {
    this.paused = true
    this.ended = true
    this.dispatchEvent(new Event('ended'))
  }

  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ) {
    this.removedListeners.push(type)
    super.removeEventListener(type, callback, options)
  }
}

const provideEngine = (audio: HtmlAudioPort, media: ReturnType<typeof makeRecordingMediaSession>) =>
  HtmlAudioEngineLayer(audio).pipe(Layer.provideMerge(media.layer))

describe('HtmlAudioEngineLayer', () => {
  it('maps play rejections to PlaybackRejected', async () => {
    const audio = new FakeAudio()
    audio.rejectNextPlay()
    const media = makeRecordingMediaSession()

    const error = await Effect.gen(function* () {
      const engine = yield* AudioEngine
      return yield* Effect.flip(engine.play)
    }).pipe(Effect.provide(provideEngine(audio, media)), Effect.scoped, Effect.runPromise)

    expect(error).toBeInstanceOf(PlaybackRejected)
  })

  it('drives an audio lifecycle and keeps browser playback integrations synchronized', async () => {
    const audio = new FakeAudio()
    const media = makeRecordingMediaSession()
    const statuses: Array<{
      sourceGeneration: number | null
      isLoaded: boolean
      playing: boolean
      didJustFinish: boolean
      currentTime: number
      duration: number
      isBuffering: boolean
    }> = []

    const clearedStatus = await Effect.gen(function* () {
      const engine = yield* AudioEngine
      yield* engine.replace('https://cdn.example/a.mp3', 7)

      yield* Effect.forkChild(
        engine.changes.pipe(
          Stream.runForEach((status) =>
            Effect.sync(() => {
              statuses.push(status)
            })
          )
        )
      )
      yield* Effect.yieldNow
      yield* Effect.yieldNow

      const pendingSeek = yield* Effect.forkChild(engine.seekTo(42))
      audio.markLoaded(90)
      yield* Fiber.join(pendingSeek)

      yield* engine.setNowPlaying({
        title: 'Night Mix',
        artist: 'DJ Test',
        artworkUrl: 'https://cdn.example/art.jpg'
      })
      yield* engine.setPositionState(90, 42)
      yield* engine.setCommandHandlers({
        onPlay: () => undefined,
        onPause: () => undefined,
        onSeekBackward: () => undefined,
        onSeekForward: () => undefined,
        onPreviousTrack: () => undefined,
        onNextTrack: () => undefined,
        onSeekTo: () => undefined
      })
      yield* engine.setVolume(1.5)
      yield* engine.setMuted(true)
      yield* engine.play
      yield* Effect.yieldNow
      yield* engine.pause
      yield* Effect.yieldNow
      audio.markEnded()
      yield* Effect.yieldNow

      yield* engine.setCommandHandlers(null)
      yield* engine.setNowPlaying(null)
      yield* engine.clearSource
      return yield* engine.currentStatus
    }).pipe(Effect.provide(provideEngine(audio, media)), Effect.scoped, Effect.runPromise)

    expect(audio.src).toBe('')
    expect(audio.currentTime).toBe(42)
    expect(audio.volume).toBe(1)
    expect(audio.muted).toBe(true)
    expect(clearedStatus).toMatchObject({
      sourceGeneration: null,
      isLoaded: false,
      playing: false
    })
    expect(statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceGeneration: 7, isLoaded: true, duration: 90 }),
        expect.objectContaining({ sourceGeneration: 7, playing: true }),
        expect.objectContaining({ sourceGeneration: 7, didJustFinish: true })
      ])
    )
    expect(media.record.metadata).toEqual([
      {
        title: 'Night Mix',
        artists: ['DJ Test'],
        artwork: 'https://cdn.example/art.jpg'
      }
    ])
    expect(media.record.positions).toEqual([{ duration: 90, position: 42 }])
    expect(media.record.handlers).toEqual([expect.any(Object), null])
    expect(media.record.playbackStates).toEqual(
      expect.arrayContaining(['playing', 'paused', 'none'])
    )
    expect(media.record.clearedMetadata).toBe(1)
    expect(audio.removedListeners).toEqual([
      'timeupdate',
      'loadedmetadata',
      'durationchange',
      'canplay',
      'waiting',
      'play',
      'pause',
      'ended'
    ])
  })
})
