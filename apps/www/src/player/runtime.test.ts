import { AudioEngine } from '@gbfm/player'
import { Context, Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'

import { makeHtmlAudioEngineLayer, type AudioPort } from './runtime'

class TestAudio extends EventTarget implements AudioPort {
  src = ''
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
})
