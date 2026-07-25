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

const makePlayer = (play: () => void): ExpoAudioEnginePlayer => ({
  currentStatus,
  play,
  pause: () => undefined,
  replace: () => undefined,
  seekTo: () => Promise.resolve(),
  clearLockScreenControls: () => undefined,
  setActiveForLockScreen: () => undefined,
  addListener: () => ({ remove: () => undefined })
})

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
})
