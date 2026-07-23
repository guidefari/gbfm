import { Effect, Schema } from 'effect'
import * as SecureStore from 'expo-secure-store'

const QUEUE_KEY = 'gbfm.audio.queue'
const POSITION_KEY_PREFIX = 'gbfm.audio.position.'
const PLAY_KEY_PREFIX = 'gbfm.audio.last-play.'

export const DEDUP_WINDOW_MS = 30 * 60 * 1000

export const QueueTrack = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  slug: Schema.String,
  url: Schema.String,
  thumbnailUrl: Schema.NullOr(Schema.String),
  type: Schema.Literals(['mix', 'track', 'misc']),
  creators: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        username: Schema.NullOr(Schema.String)
      })
    )
  )
})

export const PersistedQueue = Schema.Struct({
  tracks: Schema.Array(QueueTrack),
  currentIndex: Schema.Number
})

export type QueueTrackType = (typeof QueueTrack)['Type']
export type PersistedQueueType = (typeof PersistedQueue)['Type']

type PositionRecord = { position: number; updatedAt: number }
type PlayRecord = { at: number }

const getNumberProperty = (value: object, key: string): number | undefined => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor) return undefined
  const v = descriptor.value
  return typeof v === 'number' ? v : undefined
}

const isPositionRecord = (value: unknown): value is PositionRecord =>
  typeof value === 'object' &&
  value !== null &&
  getNumberProperty(value, 'position') !== undefined &&
  getNumberProperty(value, 'updatedAt') !== undefined

const isPlayRecord = (value: unknown): value is PlayRecord =>
  typeof value === 'object' && value !== null && getNumberProperty(value, 'at') !== undefined

const decodeRecord = <A>(
  raw: string | null,
  validate: (value: unknown) => value is A
): A | null => {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return validate(parsed) ? parsed : null
  } catch {
    return null
  }
}

const safeGet = (key: string): Effect.Effect<string | null, never, never> =>
  Effect.tryPromise(() => SecureStore.getItemAsync(key)).pipe(
    Effect.catch(() => Effect.succeed<string | null>(null))
  )

const safeSet = (key: string, value: string): Effect.Effect<void, never, never> =>
  Effect.tryPromise(() => SecureStore.setItemAsync(key, value)).pipe(
    Effect.catch(() => Effect.succeed<void>(undefined))
  )

const safeDelete = (key: string): Effect.Effect<void, never, never> =>
  Effect.tryPromise(() => SecureStore.deleteItemAsync(key)).pipe(
    Effect.catch(() => Effect.succeed<void>(undefined))
  )

export const loadQueue = (): Effect.Effect<PersistedQueueType | null, never, never> =>
  Effect.gen(function* () {
    const raw = yield* safeGet(QUEUE_KEY)
    if (raw === null) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
    const decode: Effect.Effect<PersistedQueueType, unknown, never> =
      Schema.decodeUnknownEffect(PersistedQueue)(parsed)
    return yield* decode.pipe(Effect.catch(() => Effect.succeed<PersistedQueueType | null>(null)))
  })

export const saveQueue = (queue: PersistedQueueType): Effect.Effect<void, never, never> =>
  safeSet(QUEUE_KEY, JSON.stringify(queue))

export const loadPosition = (trackId: string): Effect.Effect<PositionRecord | null, never, never> =>
  Effect.gen(function* () {
    return decodeRecord(yield* safeGet(`${POSITION_KEY_PREFIX}${trackId}`), isPositionRecord)
  })

export const savePosition = (
  trackId: string,
  position: number
): Effect.Effect<void, never, never> => {
  if (!Number.isFinite(position) || position < 0) return Effect.succeed(undefined)
  return safeSet(
    `${POSITION_KEY_PREFIX}${trackId}`,
    JSON.stringify({ position, updatedAt: Date.now() })
  )
}

export const clearPosition = (trackId: string): Effect.Effect<void, never, never> =>
  safeDelete(`${POSITION_KEY_PREFIX}${trackId}`)

export const loadPlay = (trackId: string): Effect.Effect<PlayRecord | null, never, never> =>
  Effect.gen(function* () {
    return decodeRecord(yield* safeGet(`${PLAY_KEY_PREFIX}${trackId}`), isPlayRecord)
  })

export const recordPlay = (trackId: string): Effect.Effect<void, never, never> =>
  safeSet(`${PLAY_KEY_PREFIX}${trackId}`, JSON.stringify({ at: Date.now() }))

export const isWithinDedupWindow = (trackId: string): Effect.Effect<boolean, never, never> =>
  Effect.gen(function* () {
    const last = yield* loadPlay(trackId)
    if (!last) return false
    return Date.now() - last.at < DEDUP_WINDOW_MS
  })
