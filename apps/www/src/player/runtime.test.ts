import { AudioEngine } from '@gbfm/player'
import { Context, Effect, Layer } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPreviewSession } from '../media-preview/session'
import { makeHtmlAudioEngineLayer, type AudioPort } from './runtime'

class TestAudio extends EventTarget implements AudioPort {
  private source = ''
  sourceWrites: Array<{ url: string; crossOrigin: string | null }> = []
  get src() {
    return this.source
  }
  set src(url: string) {
    this.sourceWrites.push({ url, crossOrigin: this.crossOrigin })
    this.source = url
  }
  crossOrigin: string | null = null
  currentTime = 0
  duration = 120
  paused = true
  ended = false
  readyState = 4
  volume = 1
  muted = false
  load() {}
  async play() {
    this.paused = false
    this.dispatchEvent(new Event('play'))
  }
  pause() {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }
}

afterEach(() => vi.useRealTimers())

describe('HTML audio engine', () => {
  it('controls and observes the supplied runtime-lived audio element', async () => {
    const audio = new TestAudio()

    const program = Effect.gen(function* () {
      const context = yield* Layer.build(makeHtmlAudioEngineLayer(audio))
      const engine = Context.get(context, AudioEngine)
      yield* engine.replace('/mix.mp3', 7)
      yield* engine.setVolume(0.4)
      yield* engine.play
      const status = yield* engine.currentStatus

      return { status, source: audio.src, volume: audio.volume }
    })

    const result = await Effect.runPromise(program.pipe(Effect.scoped))

    expect(result.source).toBe('/mix.mp3')
    expect(result.volume).toBe(0.4)
    expect(result.status).toMatchObject({ sourceGeneration: 7, playing: true })
  })

  it('does not require browser globals to construct the layer', () => {
    expect(Layer.isLayer(makeHtmlAudioEngineLayer(new TestAudio()))).toBe(true)
  })

  it('authorizes before setting a private source and leaves that source untouched on replay', async () => {
    vi.useFakeTimers()
    const audio = new TestAudio()
    const url = 'https://cdn.goosebumps.fm/user-content/private/owner/id/song.mp3'
    const requests: Array<string> = []
    const sourcesAtRequest: Array<string> = []

    const layer = makeHtmlAudioEngineLayer(audio, (source, onDenied) =>
      createPreviewSession(source, {
        now: Date.now,
        onDenied,
        fetch: async (input) => {
          const path =
            input instanceof Request ? input.url : input instanceof URL ? input.href : input

          requests.push(path)
          sourcesAtRequest.push(audio.src)

          return path.startsWith('/api/')
            ? Response.json({
                sessionUrl: 'https://cdn.goosebumps.fm/preview-session',
                grant: 'test',
                expiresAt: Date.now() + 300_000,
              })
            : new Response(null, { status: 204 })
        },
      }),
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const engine = Context.get(yield* Layer.build(layer), AudioEngine)
        yield* engine.replace(url, 1)
        expect(audio.src).toBe(url)
        expect(audio.crossOrigin).toBe('use-credentials')
        yield* engine.play
        yield* engine.pause
        audio.currentTime = 42
        yield* engine.play
        expect(audio.currentTime).toBe(42)
        expect(audio.src).toBe(url)
        expect(requests).toHaveLength(2)
        yield* Effect.promise(() => vi.advanceTimersByTimeAsync(120_000))
        expect(requests).toHaveLength(4)
        expect(sourcesAtRequest).toEqual(['', '', url, url])
        expect(audio.currentTime).toBe(42)
        expect(audio.sourceWrites).toEqual([{ url, crossOrigin: 'use-credentials' }])
        yield* engine.replace('/public.mp3', 2)
        expect(audio.crossOrigin).toBe(null)
        expect(audio.src).toBe('/public.mp3')
      }).pipe(Effect.scoped),
    )
  })

  it('does not load or play private media after permission is denied', async () => {
    const audio = new TestAudio()
    let denied = 0

    const layer = makeHtmlAudioEngineLayer(audio, (url) =>
      createPreviewSession(url, {
        now: Date.now,
        onDenied: () => {
          denied++
        },
        fetch: async () => new Response(null, { status: 403 }),
      }),
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const engine = Context.get(yield* Layer.build(layer), AudioEngine)
        yield* engine.replace('https://cdn.goosebumps.fm/user-content/private/owner/id/song.mp3', 1)
        const result = yield* Effect.result(engine.play)
        expect(result._tag).toBe('Failure')
        expect(audio.src).toBe('')
        expect(audio.paused).toBe(true)
        expect(denied).toBe(1)
      }).pipe(Effect.scoped),
    )
  })
})
