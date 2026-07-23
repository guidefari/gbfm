import { Effect, Schema } from 'effect'

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

export class AudioStorageError extends Error {
  readonly _tag = 'AudioStorageError'

  constructor(
    readonly operation: 'read' | 'write' | 'delete' | 'parse',
    cause?: unknown
  ) {
    super(`Unable to ${operation} audio playback state`, { cause })
  }
}

export const parsePersistedQueue = (
  value: unknown
): Effect.Effect<PersistedQueueType, AudioStorageError, never> =>
  Schema.decodeUnknownEffect(PersistedQueue)(value).pipe(
    Effect.mapError((cause) => new AudioStorageError('parse', cause)),
    Effect.filterOrFail(
      (queue) => {
        const indexIsValid =
          Number.isInteger(queue.currentIndex) &&
          (queue.tracks.length === 0
            ? queue.currentIndex === -1
            : queue.currentIndex >= -1 && queue.currentIndex < queue.tracks.length)
        return (
          indexIsValid &&
          new Set(queue.tracks.map((track) => track.id)).size === queue.tracks.length
        )
      },
      () => new AudioStorageError('parse')
    )
  )
