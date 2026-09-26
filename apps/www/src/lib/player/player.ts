import {
  PersistedQueue,
  reduceQueue,
  type PersistedQueueType,
  type QueueTrackType,
} from '@gbfm/player'
import { Data, Option, Schema } from 'effect'

const QUEUE_KEY = 'gbfm-audio-queue.json'

const VOLUME_KEY = 'gbfm-audio-volume.json'

const POSITION_PREFIX = 'gbfm-audio-position-'

const PREFERENCES_KEY = 'gbfm-player-preferences.json'

export type PlayerSnapshot = {
  readonly queue: PersistedQueueType
  readonly playing: boolean
  readonly currentTime: number
  readonly duration: number
  readonly volume: number
  readonly muted: boolean
}

const emptyQueue: PersistedQueueType = { tracks: [], currentIndex: -1 }

const PlayTrackEvent = Schema.Struct({
  url: Schema.String,
  title: Schema.String,
  artwork: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.NullOr(Schema.String)),
  id: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.String),
  type: Schema.optional(Schema.Literals(['mix', 'track', 'misc'])),
})

const canonicalAudioUrl = (value: string): string => {
  try {
    const url = new URL(value)

    if (url.hostname === 'cdn.dev.goosebumps.fm') url.hostname = 'cdn.goosebumps.fm'

    return url.href
  } catch {
    return value
  }
}

const VolumeState = Schema.Struct({ volume: Schema.Number, isMuted: Schema.Boolean })

const PositionState = Schema.Struct({ position: Schema.Number })

const PlayerPreferences = Schema.Struct({
  continueQueue: Schema.Boolean,
  restorePosition: Schema.Boolean,
})

const QueueEvent = Data.taggedEnum<
  | { readonly _tag: 'playNow'; readonly track: QueueTrackType }
  | { readonly _tag: 'enqueue'; readonly track: QueueTrackType }
  | { readonly _tag: 'playIndex'; readonly index: number }
  | { readonly _tag: 'remove'; readonly index: number }
  | { readonly _tag: 'reorder'; readonly from: number; readonly to: number }
>()

export type PlayerPreferences = typeof PlayerPreferences.Type

export const defaultPlayerPreferences: PlayerPreferences = {
  continueQueue: true,
  restorePosition: true,
}

export const readPlayerPreferences = (): PlayerPreferences => {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY)

    const value = Option.getOrNull(
      Schema.decodeUnknownOption(PlayerPreferences)(stored ? JSON.parse(stored) : null),
    )

    return value ?? defaultPlayerPreferences
  } catch {
    return defaultPlayerPreferences
  }
}

export const savePlayerPreferences = (preferences: PlayerPreferences) => {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
}

export const parsePlayTrackEvent = (value: Schema.Json): QueueTrackType | null => {
  const parsed = Option.getOrNull(Schema.decodeUnknownOption(PlayTrackEvent)(value))

  if (!parsed || !parsed.url || !parsed.title) return null
  const url = canonicalAudioUrl(parsed.url)

  return {
    id: parsed.id || url,
    title: parsed.title,
    slug: parsed.slug ?? '',
    url,
    thumbnailUrl: parsed.thumbnailUrl ?? parsed.artwork ?? null,
    type: parsed.type ?? 'misc',
  }
}

const parseQueue = (raw: string | null): PersistedQueueType => {
  if (raw === null) return emptyQueue

  try {
    const queue = Option.getOrNull(Schema.decodeUnknownOption(PersistedQueue)(JSON.parse(raw)))

    if (!queue) return emptyQueue
    const index = queue.currentIndex

    if ((queue.tracks.length === 0 && index !== -1) || index < -1 || index >= queue.tracks.length) {
      return emptyQueue
    }

    if (new Set(queue.tracks.map((track) => track.id)).size !== queue.tracks.length)
      return emptyQueue

    return {
      ...queue,
      tracks: queue.tracks.map((track) => ({ ...track, url: canonicalAudioUrl(track.url) })),
    }
  } catch {
    return emptyQueue
  }
}

const finiteNumber = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

export class PersistentPlayer {
  readonly audio: HTMLAudioElement
  #queue: PersistedQueueType
  #volume = 100
  #muted = false
  #preferences = defaultPlayerPreferences
  #listeners = new Set<(snapshot: PlayerSnapshot) => void>()
  #snapshot: PlayerSnapshot
  #positionTimer: ReturnType<typeof setInterval> | undefined

  constructor(audio: HTMLAudioElement) {
    this.audio = audio
    this.#queue = parseQueue(this.#read(QUEUE_KEY))
    this.#preferences = readPlayerPreferences()
    const volume = this.#parseVolume(this.#read(VOLUME_KEY))
    this.#volume = volume.volume
    this.#muted = volume.muted
    audio.volume = this.#volume / 100
    audio.muted = this.#muted
    this.#snapshot = this.#makeSnapshot()

    audio.addEventListener('play', this.#onAudioChange)
    audio.addEventListener('pause', this.#onAudioChange)
    audio.addEventListener('timeupdate', this.#onAudioChange)
    audio.addEventListener('durationchange', this.#onAudioChange)
    audio.addEventListener('ended', this.#onEnded)
    this.#installCurrent(false)
    this.#installMediaSession()
    this.#positionTimer = setInterval(() => this.#persistPosition(), 2_000)
  }

  get snapshot() {
    return this.#snapshot
  }

  subscribe(listener: (snapshot: PlayerSnapshot) => void) {
    this.#listeners.add(listener)
    listener(this.#snapshot)

    return () => this.#listeners.delete(listener)
  }

  destroy() {
    this.#persistPosition()

    if (this.#positionTimer) clearInterval(this.#positionTimer)
    this.audio.pause()
    this.audio.removeEventListener('play', this.#onAudioChange)
    this.audio.removeEventListener('pause', this.#onAudioChange)
    this.audio.removeEventListener('timeupdate', this.#onAudioChange)
    this.audio.removeEventListener('durationchange', this.#onAudioChange)
    this.audio.removeEventListener('ended', this.#onEnded)

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null

      for (const action of mediaSessionActions) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          // Some browsers expose Media Session but omit individual actions.
        }
      }
    }
  }

  playTrack(track: QueueTrackType) {
    this.#setQueue(reduceQueue(this.#queue, QueueEvent.playNow({ track })))
    this.#installCurrent(true)
  }

  enqueue(track: QueueTrackType) {
    this.#setQueue(reduceQueue(this.#queue, QueueEvent.enqueue({ track })))
  }

  toggle() {
    if (!this.current) return

    if (this.audio.paused) void this.audio.play()
    else this.audio.pause()
  }

  previous() {
    if (this.audio.currentTime > 5) return this.seek(0)
    this.playIndex(this.#queue.currentIndex - 1)
  }

  next() {
    this.playIndex(this.#queue.currentIndex + 1)
  }

  playIndex(index: number) {
    if (index < 0 || index >= this.#queue.tracks.length) return
    this.#persistPosition()
    this.#setQueue(reduceQueue(this.#queue, QueueEvent.playIndex({ index })))
    this.#installCurrent(true)
  }

  seek(seconds: number) {
    if (!Number.isFinite(seconds)) return
    this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || seconds))
    this.#emit()
  }

  jump(seconds: number) {
    this.seek(this.audio.currentTime + seconds)
  }

  setVolume(volume: number) {
    this.#volume = Math.max(0, Math.min(100, volume))
    this.audio.volume = this.#volume / 100

    if (this.#volume > 0 && this.#muted) this.#muted = this.audio.muted = false
    this.#persistVolume()
    this.#emit()
  }

  toggleMute() {
    this.#muted = !this.#muted
    this.audio.muted = this.#muted
    this.#persistVolume()
    this.#emit()
  }

  setPreferences(preferences: PlayerPreferences) {
    this.#preferences = preferences
  }

  remove(index: number) {
    const removingCurrent = index === this.#queue.currentIndex
    this.#setQueue(reduceQueue(this.#queue, QueueEvent.remove({ index })))

    if (removingCurrent) this.#installCurrent(!this.audio.paused)
  }

  reorder(from: number, to: number) {
    this.#setQueue(reduceQueue(this.#queue, QueueEvent.reorder({ from, to })))
  }

  clear() {
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.#setQueue(emptyQueue)
    this.#setMetadata(null)
  }

  get current() {
    return this.#queue.tracks[this.#queue.currentIndex] ?? null
  }

  #installCurrent(autoplay: boolean) {
    const track = this.current

    if (!track) {
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.audio.load()
      this.#setMetadata(null)

      return this.#emit()
    }

    if (this.audio.src !== new URL(track.url, location.href).href) {
      this.audio.src = track.url

      const restore = () => {
        const record = this.#preferences.restorePosition
          ? this.#read(`${POSITION_PREFIX}${encodeURIComponent(track.id)}.json`)
          : null

        if (record) {
          try {
            const value = Option.getOrNull(
              Schema.decodeUnknownOption(PositionState)(JSON.parse(record)),
            )

            if (value) this.seek(finiteNumber(value.position, 0))
          } catch {
            // Ignore corrupt checkpoints.
          }
        }

        if (autoplay) void this.audio.play()
      }

      this.audio.addEventListener('loadedmetadata', restore, { once: true })
    } else if (autoplay) void this.audio.play()
    this.#setMetadata(track)
    this.#emit()
  }

  #onAudioChange = () => {
    this.#emit()

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = this.audio.paused ? 'paused' : 'playing'

      if (this.audio.duration > 0 && Number.isFinite(this.audio.duration)) {
        navigator.mediaSession.setPositionState({
          duration: this.audio.duration,
          position: Math.min(this.audio.currentTime, this.audio.duration),
          playbackRate: this.audio.playbackRate,
        })
      }
    }
  }

  #onEnded = () => {
    if (this.#preferences.continueQueue && this.#queue.currentIndex < this.#queue.tracks.length - 1)
      this.next()
    else this.#emit()
  }

  #setQueue(queue: PersistedQueueType) {
    this.#queue = queue
    this.#write(QUEUE_KEY, JSON.stringify(queue))
    this.#emit()
  }

  #makeSnapshot(): PlayerSnapshot {
    return {
      queue: this.#queue,
      playing: !this.audio.paused,
      currentTime: finiteNumber(this.audio.currentTime, 0),
      duration: finiteNumber(this.audio.duration, 0),
      volume: this.#volume,
      muted: this.#muted,
    }
  }

  #emit() {
    this.#snapshot = this.#makeSnapshot()

    for (const listener of this.#listeners) listener(this.#snapshot)
  }

  #persistPosition() {
    const track = this.current

    if (!track || !Number.isFinite(this.audio.currentTime)) return
    this.#write(
      `${POSITION_PREFIX}${encodeURIComponent(track.id)}.json`,
      JSON.stringify({ position: this.audio.currentTime, updatedAt: Date.now() }),
    )
  }

  #parseVolume(raw: string | null) {
    if (!raw) return { volume: 100, muted: false }

    try {
      const value = Option.getOrNull(Schema.decodeUnknownOption(VolumeState)(JSON.parse(raw)))

      if (!value) return { volume: 100, muted: false }

      return {
        volume: Math.max(0, Math.min(100, finiteNumber(value.volume, 100))),
        muted: value.isMuted,
      }
    } catch {
      return { volume: 100, muted: false }
    }
  }

  #persistVolume() {
    this.#write(VOLUME_KEY, JSON.stringify({ volume: this.#volume, isMuted: this.#muted }))
  }

  #read(key: string) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  #write(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Playback remains available when storage is blocked or full.
    }
  }

  #setMetadata(track: QueueTrackType | null) {
    if (!('mediaSession' in navigator)) return

    if (!track) {
      navigator.mediaSession.metadata = null

      return
    }

    const metadata: MediaMetadataInit = { title: track.title }

    if (track.creators) metadata.artist = track.creators.map((creator) => creator.name).join(', ')

    if (track.thumbnailUrl) metadata.artwork = [{ src: track.thumbnailUrl }]

    navigator.mediaSession.metadata = new MediaMetadata(metadata)
  }

  #installMediaSession() {
    if (!('mediaSession' in navigator)) return

    const actions: ReadonlyArray<readonly [MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => void this.audio.play()],
      ['pause', () => this.audio.pause()],
      ['previoustrack', () => this.previous()],
      ['nexttrack', () => this.next()],
      ['seekbackward', (details) => this.jump(-(details.seekOffset ?? 10))],
      ['seekforward', (details) => this.jump(details.seekOffset ?? 10)],
      ['seekto', (details) => this.seek(details.seekTime ?? 0)],
    ]

    for (const [action, handler] of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // Some browsers expose Media Session but omit individual actions.
      }
    }
  }
}

const mediaSessionActions: ReadonlyArray<MediaSessionAction> = [
  'play',
  'pause',
  'previoustrack',
  'nexttrack',
  'seekbackward',
  'seekforward',
  'seekto',
]
