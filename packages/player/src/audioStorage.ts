import { Effect, Schema } from 'effect'
import { AudioStorageError, parsePersistedQueue, type PersistedQueueType } from './persistedQueue'

const QUEUE_KEY = 'gbfm-audio-queue.json'
const POSITION_KEY_PREFIX = 'gbfm-audio-position-'
const PLAY_KEY_PREFIX = 'gbfm-audio-last-play-'
const VOLUME_KEY = 'gbfm-audio-volume.json'

export const DEDUP_WINDOW_MS = 30 * 60 * 1000

const PositionRecord = Schema.Struct({ position: Schema.Number, updatedAt: Schema.Number })
const PlayRecord = Schema.Struct({ at: Schema.Number })
const VolumeRecord = Schema.Struct({ volume: Schema.Number, isMuted: Schema.Boolean })

export type PositionRecordType = (typeof PositionRecord)['Type']
export type VolumeRecordType = (typeof VolumeRecord)['Type']

export type AudioStorageAdapter = {
  readonly read: (key: string) => Promise<string | null>
  readonly write: (key: string, value: string) => Promise<void>
  readonly remove: (key: string) => Promise<void>
}

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type BrowserStorageSource = BrowserStorage | (() => BrowserStorage | undefined) | undefined

export const createWebAudioStorageAdapter = (
  source: BrowserStorageSource
): AudioStorageAdapter => ({
  read: (key) => {
    const storage = typeof source === 'function' ? source() : source
    return Promise.resolve(storage?.getItem(key) ?? null)
  },
  write: (key, value) => {
    const storage = typeof source === 'function' ? source() : source
    storage?.setItem(key, value)
    return Promise.resolve()
  },
  remove: (key) => {
    const storage = typeof source === 'function' ? source() : source
    storage?.removeItem(key)
    return Promise.resolve()
  }
})

const keyForTrack = (prefix: string, trackId: string) =>
  `${prefix}${encodeURIComponent(trackId)}.json`

const parseJson = (raw: string): Effect.Effect<unknown, AudioStorageError, never> =>
  Effect.try({
    try: (): unknown => JSON.parse(raw),
    catch: (cause) => new AudioStorageError('parse', cause)
  })

export const createAudioStorage = (adapter: AudioStorageAdapter, now: () => number = Date.now) => {
  const read = (key: string): Effect.Effect<string | null, AudioStorageError, never> =>
    Effect.tryPromise({
      try: () => adapter.read(key),
      catch: (cause) => new AudioStorageError('read', cause)
    })

  const write = (key: string, value: string): Effect.Effect<void, AudioStorageError, never> =>
    Effect.tryPromise({
      try: () => adapter.write(key, value),
      catch: (cause) => new AudioStorageError('write', cause)
    })

  const remove = (key: string): Effect.Effect<void, AudioStorageError, never> =>
    Effect.tryPromise({
      try: () => adapter.remove(key),
      catch: (cause) => new AudioStorageError('delete', cause)
    })

  const loadQueue = (): Effect.Effect<PersistedQueueType | null, AudioStorageError, never> =>
    Effect.gen(function* () {
      const raw = yield* read(QUEUE_KEY)
      if (raw === null) return null
      return yield* Effect.flatMap(parseJson(raw), parsePersistedQueue)
    })

  const saveQueue = (queue: PersistedQueueType): Effect.Effect<void, AudioStorageError, never> =>
    write(QUEUE_KEY, JSON.stringify(queue))

  const loadPosition = (
    trackId: string
  ): Effect.Effect<PositionRecordType | null, AudioStorageError, never> =>
    Effect.gen(function* () {
      const raw = yield* read(keyForTrack(POSITION_KEY_PREFIX, trackId))
      if (raw === null) return null
      const value = yield* parseJson(raw)
      const record = yield* Schema.decodeUnknownEffect(PositionRecord)(value).pipe(
        Effect.mapError((cause) => new AudioStorageError('parse', cause))
      )
      if (
        !Number.isFinite(record.position) ||
        record.position < 0 ||
        !Number.isFinite(record.updatedAt)
      ) {
        return yield* Effect.fail(new AudioStorageError('parse'))
      }
      return record
    })

  const savePosition = (
    trackId: string,
    position: number
  ): Effect.Effect<void, AudioStorageError, never> => {
    if (!Number.isFinite(position) || position < 0) {
      return Effect.fail(new AudioStorageError('write'))
    }
    return write(
      keyForTrack(POSITION_KEY_PREFIX, trackId),
      JSON.stringify({ position, updatedAt: now() })
    )
  }

  const clearPosition = (trackId: string): Effect.Effect<void, AudioStorageError, never> =>
    remove(keyForTrack(POSITION_KEY_PREFIX, trackId))

  const loadPlay = (
    trackId: string
  ): Effect.Effect<{ readonly at: number } | null, AudioStorageError, never> =>
    Effect.gen(function* () {
      const raw = yield* read(keyForTrack(PLAY_KEY_PREFIX, trackId))
      if (raw === null) return null
      const value = yield* parseJson(raw)
      const record = yield* Schema.decodeUnknownEffect(PlayRecord)(value).pipe(
        Effect.mapError((cause) => new AudioStorageError('parse', cause))
      )
      if (!Number.isFinite(record.at)) return yield* Effect.fail(new AudioStorageError('parse'))
      return record
    })

  const recordPlay = (trackId: string): Effect.Effect<void, AudioStorageError, never> =>
    write(keyForTrack(PLAY_KEY_PREFIX, trackId), JSON.stringify({ at: now() }))

  const isWithinDedupWindow = (trackId: string): Effect.Effect<boolean, AudioStorageError, never> =>
    Effect.gen(function* () {
      const last = yield* loadPlay(trackId)
      return last !== null && now() - last.at < DEDUP_WINDOW_MS
    })

  const loadVolume = (): Effect.Effect<VolumeRecordType | null, AudioStorageError, never> =>
    Effect.gen(function* () {
      const raw = yield* read(VOLUME_KEY)
      if (raw === null) return null
      const value = yield* parseJson(raw)
      const record = yield* Schema.decodeUnknownEffect(VolumeRecord)(value).pipe(
        Effect.mapError((cause) => new AudioStorageError('parse', cause))
      )
      if (!Number.isFinite(record.volume) || record.volume < 0 || record.volume > 100) {
        return yield* Effect.fail(new AudioStorageError('parse'))
      }
      return {
        volume: Math.max(0, Math.min(100, record.volume)),
        isMuted: record.isMuted
      }
    })

  const saveVolume = (volume: VolumeRecordType): Effect.Effect<void, AudioStorageError, never> =>
    write(VOLUME_KEY, JSON.stringify(volume))

  return {
    clearPosition,
    isWithinDedupWindow,
    loadPlay,
    loadPosition,
    loadQueue,
    loadVolume,
    recordPlay,
    savePosition,
    saveQueue,
    saveVolume
  }
}
