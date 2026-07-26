import { AudioEngine, PlaybackRejected } from '@gbfm/player'
import { Effect } from 'effect'
import type { AudioStatus } from 'expo-audio'
import { describe, expect, test } from 'vitest'
import { ExpoAudioEngineLayer, type ExpoAudioEnginePlayer } from './expoAudioEngine'

const currentStatus: AudioStatus = {
  id: 'player',
  isLoaded: true,
  duration: 60,
  currentTime: 0,
  playbackState: '',
  timeControlStatus: 'paused',
  reasonForWaitingToPlay: '',
  playing: false,
  didJustFinish: false,
  isBuffering: false,
  playbackRate: 1,
  shouldCorrectPitch: true,
  mute: false,
  loop: false,
  isLive: false,
  currentOffsetFromLive: null,
  error: null
}

const makePlayer = (play: () => void): ExpoAudioEnginePlayer => {
  let status = { ...currentStatus }
  let volume = 1
  let muted = false

  return {
    get currentStatus() {
      return status
    },
    play,
    pause: () => {
      status = { ...status, playing: false }
    },
    replace: (source) => {
      if (source === null) {
        status = {
          ...status,
          isLoaded: false,
          playing: false,
          didJustFinish: false,
          currentTime: 0,
          duration: 0,
          isBuffering: false
        }
      }
    },
    seekTo: () => Promise.resolve(),
    get volume() {
      return volume
    },
    set volume(value: number) {
      volume = value
    },
    get muted() {
      return muted
    },
    set muted(value: boolean) {
      muted = value
    },
    clearLockScreenControls: () => undefined,
    setActiveForLockScreen: () => undefined,
    addListener: () => ({ remove: () => undefined })
  }
}

describe('ExpoAudioEngineLayer', () => {
  test('translates platform play failures into PlaybackRejected', async () => {
    const failure = new Error('audio session unavailable')
    const player = makePlayer(() => {
      throw failure
    })

    const error = await Effect.gen(function* () {
      const engine = yield* AudioEngine
      return yield* Effect.flip(engine.play)
    }).pipe(Effect.provide(ExpoAudioEngineLayer(player, 'native')), Effect.runPromise)

    expect(error).toBeInstanceOf(PlaybackRejected)
    expect(error.cause).toBe(failure)
  })

  test('applies volume and mute changes to the player', async () => {
    const player = makePlayer(() => undefined)

    await Effect.gen(function* () {
      const engine = yield* AudioEngine
      yield* engine.setVolume(0.25)
      yield* engine.setMuted(true)
    }).pipe(Effect.provide(ExpoAudioEngineLayer(player, 'native')), Effect.runPromise)

    expect(player.volume).toBe(0.25)
    expect(player.muted).toBe(true)
  })

  test('clears the source when reset', async () => {
    const player = makePlayer(() => undefined)

    const status = await Effect.gen(function* () {
      const engine = yield* AudioEngine
      yield* engine.replace('https://cdn.example/track.mp3', 9)
      yield* engine.clearSource
      return yield* engine.currentStatus
    }).pipe(Effect.provide(ExpoAudioEngineLayer(player, 'native')), Effect.runPromise)

    expect(status.sourceGeneration).toBeNull()
    expect(status.isLoaded).toBe(false)
  })
})
