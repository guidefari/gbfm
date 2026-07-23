import type { AudioStatus } from 'expo-audio'

type PlaybackStatusPlayer = {
  readonly currentStatus: AudioStatus
  readonly addListener: (
    event: 'playbackStatusUpdate',
    listener: (status: AudioStatus) => void
  ) => { readonly remove: () => void }
}

type IntervalScheduler = {
  readonly setInterval: (
    callback: () => void,
    milliseconds: number
  ) => ReturnType<typeof setInterval>
  readonly clearInterval: (interval: ReturnType<typeof setInterval>) => void
}

const defaultScheduler: IntervalScheduler = {
  setInterval: (callback, milliseconds) => setInterval(callback, milliseconds),
  clearInterval: (interval) => clearInterval(interval)
}

export const subscribeToPlaybackStatus = (
  player: PlaybackStatusPlayer,
  platform: 'native' | 'web',
  listener: (status: AudioStatus) => void,
  scheduler: IntervalScheduler = defaultScheduler
) => {
  const subscription = player.addListener('playbackStatusUpdate', listener)
  const interval =
    platform === 'web'
      ? scheduler.setInterval(() => {
          const status = player.currentStatus
          if (status.didJustFinish) listener(status)
        }, 500)
      : null

  return {
    remove: () => {
      subscription.remove()
      if (interval !== null) scheduler.clearInterval(interval)
    }
  }
}
