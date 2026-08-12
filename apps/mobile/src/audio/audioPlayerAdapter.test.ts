import type { AudioStatus } from 'expo-audio'
import { expect, test } from 'vitest'
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

test('forwards the native event payload and removes the native subscription', () => {
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

test('polls web completion status and disposes both status sources', () => {
  const source = createPlayer()
  const received: Array<AudioStatus> = []
  let poll: (() => void) | undefined
  let cleared = false
  const subscription = subscribeToPlaybackStatus(
    source.player,
    'web',
    (next) => received.push(next),
    {
      setInterval: (callback) => {
        poll = callback
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

  poll?.()
  subscription.remove()

  expect(received).toEqual([completed])
  expect(source.wasRemoved()).toBe(true)
  expect(cleared).toBe(true)
})
