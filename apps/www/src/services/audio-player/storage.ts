import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

const KEY = (trackId: string) => `gbfm:audio:position:${trackId}`

export interface AudioStorageShape {
  readPosition: (trackId: string) => Effect.Effect<number | null>
  writePosition: (trackId: string, time: number) => Effect.Effect<void>
  clear: (trackId: string) => Effect.Effect<void>
}

export class AudioStorage extends Context.Service<AudioStorage, AudioStorageShape>()(
  '@gbfm/www/AudioStorage'
) {}

export const AudioStorageLive = Layer.sync(AudioStorage, () => ({
  readPosition: (trackId: string) =>
    Effect.sync(() => {
      try {
        const raw = localStorage.getItem(KEY(trackId))
        if (!raw) return null
        const val = Number(raw)
        return Number.isFinite(val) ? val : null
      } catch {
        return null
      }
    }),

  writePosition: (trackId: string, time: number) =>
    Effect.sync(() => {
      try {
        localStorage.setItem(KEY(trackId), String(time))
      } catch {}
    }),

  clear: (trackId: string) =>
    Effect.sync(() => {
      try {
        localStorage.removeItem(KEY(trackId))
      } catch {}
    })
}))

export const readPosition = (trackId: string) =>
  Effect.andThen(AudioStorage, (s) => s.readPosition(trackId))

export const writePosition = (trackId: string, time: number) =>
  Effect.andThen(AudioStorage, (s) => s.writePosition(trackId, time))

export const clearPosition = (trackId: string) =>
  Effect.andThen(AudioStorage, (s) => s.clear(trackId))

export const AudioStorageTest = Layer.succeed(AudioStorage, {
  readPosition: (_trackId: string) => Effect.succeed(null),
  writePosition: (_trackId: string, _time: number) => Effect.void,
  clear: (_trackId: string) => Effect.void
})

export const AudioStorageInMemory = Layer.sync(AudioStorage, () => {
  const store = new Map<string, number>()
  return {
    readPosition: (trackId: string) => Effect.sync(() => store.get(trackId) ?? null),
    writePosition: (trackId: string, time: number) =>
      Effect.sync(() => {
        store.set(trackId, time)
      }),
    clear: (trackId: string) =>
      Effect.sync(() => {
        store.delete(trackId)
      })
  }
})
