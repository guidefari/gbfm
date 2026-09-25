import type { Schema } from 'effect'
import { getContext, setContext } from 'svelte'
import { writable, type Readable, type Writable } from 'svelte/store'
import type { PlayerPreferences, PlayerSnapshot } from './player'
import { PersistentPlayer, parsePlayTrackEvent, savePlayerPreferences } from './player'

const PLAYER_CONTEXT = Symbol('gbfm-player')

export type PlayerContext = {
  readonly snapshot: Readable<PlayerSnapshot | null>
  readonly fullscreen: Writable<boolean>
  readonly initialize: () => () => void
  readonly play: (input: Schema.Json) => boolean
  readonly enqueue: (input: Schema.Json) => boolean
  readonly toggle: () => void
  readonly previous: () => void
  readonly next: () => void
  readonly playIndex: (index: number) => void
  readonly seek: (seconds: number) => void
  readonly jump: (seconds: number) => void
  readonly setVolume: (volume: number) => void
  readonly toggleMute: () => void
  readonly remove: (index: number) => void
  readonly reorder: (from: number, to: number) => void
  readonly clear: () => void
  readonly updatePreferences: (preferences: PlayerPreferences) => void
}

const report = (name: 'enqueue' | 'play') =>
  navigator.sendBeacon(
    '/telemetry/browser',
    JSON.stringify({ kind: 'player', name, route: location.pathname })
  )

export const createPlayerContext = (): PlayerContext => {
  const snapshot = writable<PlayerSnapshot | null>(null)
  const fullscreen = writable(false)
  let player: PersistentPlayer | undefined
  let unsubscribe: (() => void) | undefined

  const context: PlayerContext = {
    snapshot,
    fullscreen,
    initialize: () => {
      player ??= new PersistentPlayer(new Audio())
      unsubscribe ??= player.subscribe(snapshot.set)

      return () => {
        unsubscribe?.()
        unsubscribe = undefined
        player?.destroy()
        player = undefined
        snapshot.set(null)
      }
    },
    play: (input) => {
      const track = parsePlayTrackEvent(input)
      if (!track || !player) return false
      player.playTrack(track)
      report('play')
      return true
    },
    enqueue: (input) => {
      const track = parsePlayTrackEvent(input)
      if (!track || !player) return false
      player.enqueue(track)
      report('enqueue')
      return true
    },
    toggle: () => player?.toggle(),
    previous: () => player?.previous(),
    next: () => player?.next(),
    playIndex: (index) => player?.playIndex(index),
    seek: (seconds) => player?.seek(seconds),
    jump: (seconds) => player?.jump(seconds),
    setVolume: (volume) => player?.setVolume(volume),
    toggleMute: () => player?.toggleMute(),
    remove: (index) => player?.remove(index),
    reorder: (from, to) => player?.reorder(from, to),
    clear: () => player?.clear(),
    updatePreferences: (preferences) => {
      savePlayerPreferences(preferences)
      player?.setPreferences(preferences)
    }
  }

  setContext(PLAYER_CONTEXT, context)
  return context
}

export const getPlayerContext = (): PlayerContext => getContext(PLAYER_CONTEXT)
