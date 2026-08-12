import { AudioEngine, PlaybackRejected } from '@gbfm/player'
import { Effect, Layer, Stream } from 'effect'
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
    clearMetadata: () =>
      Effect.sync(() => {
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

  it('tags statuses with the generation installed by replace', async () => {
    const audio = new FakeAudio()
    const media = makeRecordingMediaSession()

    const status = await Effect.gen(function* () {
      const engine = yield* AudioEngine
      yield* engine.replace('https://cdn.example/a.mp3', 7)
      audio.markLoaded(90)
      return yield* engine.currentStatus
    }).pipe(Effect.provide(provideEngine(audio, media)), Effect.scoped, Effect.runPromise)

    expect(status.sourceGeneration).toBe(7)
    expect(status.isLoaded).toBe(true)
    expect(status.duration).toBe(90)
  })

  it('clears the source generation when the source is reset', async () => {
    const audio = new FakeAudio()
    const media = makeRecordingMediaSession()

    const status = await Effect.gen(function* () {
      const engine = yield* AudioEngine
      yield* engine.replace('https://cdn.example/a.mp3', 7)
      yield* engine.clearSource
      return yield* engine.currentStatus
    }).pipe(Effect.provide(provideEngine(audio, media)), Effect.scoped, Effect.runPromise)

    expect(status.sourceGeneration).toBeNull()
    expect(status.isLoaded).toBe(false)
    expect(status.playing).toBe(false)
  })

  it('applies volume and mute changes to the audio element', async () => {
    const audio = new FakeAudio()
    const media = makeRecordingMediaSession()

    await Effect.gen(function* () {
      const engine = yield* AudioEngine
      yield* engine.setVolume(0.25)
      yield* engine.setMuted(true)
    }).pipe(Effect.provide(provideEngine(audio, media)), Effect.scoped, Effect.runPromise)

    expect(audio.volume).toBe(0.25)
    expect(audio.muted).toBe(true)
  })

  it('updates Media Session on play and removes listeners when the scope closes', async () => {
    const audio = new FakeAudio()
    const media = makeRecordingMediaSession()
    let streamFinalized = false

    await Effect.gen(function* () {
      const engine = yield* AudioEngine
      yield* engine.replace('https://cdn.example/a.mp3', 1)

      yield* Effect.forkChild(
        engine.changes.pipe(
          Stream.ensuring(
            Effect.sync(() => {
              streamFinalized = true
            })
          ),
          Stream.runDrain
        )
      )

      yield* Effect.yieldNow
      yield* Effect.yieldNow

      audio.markLoaded(60)
      yield* engine.play
      yield* Effect.yieldNow
      yield* Effect.yieldNow
    }).pipe(Effect.provide(provideEngine(audio, media)), Effect.scoped, Effect.runPromise)

    expect(media.record.playbackStates).toContain('playing')
    expect(streamFinalized).toBe(true)
    expect(() => {
      audio.dispatchEvent(new Event('timeupdate'))
      audio.dispatchEvent(new Event('play'))
    }).not.toThrow()
  })

  it('clears Media Session when now playing is null', async () => {
    const audio = new FakeAudio()
    const media = makeRecordingMediaSession()

    await Effect.gen(function* () {
      const engine = yield* AudioEngine
      yield* engine.setNowPlaying({ title: 'Mix', artist: 'DJ' })
      yield* engine.setNowPlaying(null)
    }).pipe(Effect.provide(provideEngine(audio, media)), Effect.scoped, Effect.runPromise)

    expect(media.record.metadata).toEqual([{ title: 'Mix', artists: ['DJ'], artwork: undefined }])
    expect(media.record.clearedMetadata).toBe(1)
    expect(media.record.playbackStates).toContain('none')
  })
})
