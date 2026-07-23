import type { AudioStatus } from 'expo-audio'
import { describe, expect, test } from 'vitest'
import { subscribeToPlaybackStatus } from './audioPlayerAdapter'

const status = (didJustFinish: boolean): AudioStatus => ({
  id: 'player',
  isLoaded: true,
  duration: 60,
  currentTime: didJustFinish ? 60 : 0,
  playbackState: '',
  timeControlStatus: didJustFinish ? 'paused' : 'playing',
  reasonForWaitingToPlay: '',
  playing: !didJustFinish,
  didJustFinish,
  isBuffering: false,
  playbackRate: 1,
  shouldCorrectPitch: true,
  mute: false,
  loop: false,
  isLive: false,
  currentOffsetFromLive: null,
  error: null
})

const createPlayer = () => {
  let listener: ((next: AudioStatus) => void) | null = null
  let removed = false
  return {
    player: {
      currentStatus: status(false),
      addListener: (_event: 'playbackStatusUpdate', next: (value: AudioStatus) => void) => {
        listener = next
        return { remove: () => (removed = true) }
      }
    },
    emit: (next: AudioStatus) => listener?.(next),
    wasRemoved: () => removed
  }
}

describe('audio player status adapter', () => {
  test('forwards the native event payload rather than rereading currentStatus', () => {
    const source = createPlayer()
    const received: Array<AudioStatus> = []
    const subscription = subscribeToPlaybackStatus(source.player, 'native', (next) =>
      received.push(next)
    )
    const completed = status(true)

    source.emit(completed)
    subscription.remove()

    expect(received).toEqual([completed])
    expect(source.wasRemoved()).toBe(true)
  })

  test('polls web currentStatus because expo-audio does not emit from onended', () => {
    const source = createPlayer()
    const received: Array<AudioStatus> = []
    const polling: { callback?: () => void } = {}
    let cleared = false
    const subscription = subscribeToPlaybackStatus(
      source.player,
      'web',
      (next) => received.push(next),
      {
        setInterval: (callback) => {
          polling.callback = callback
          return setInterval(() => undefined, 60_000)
        },
        clearInterval: (interval) => {
          clearInterval(interval)
          cleared = true
        }
      }
    )
    const completed = status(true)
    source.player.currentStatus = completed

    polling.callback?.()
    subscription.remove()

    expect(received).toEqual([completed])
    expect(cleared).toBe(true)
  })
})
