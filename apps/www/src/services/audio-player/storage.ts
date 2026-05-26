import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

const KEY = (trackId: string) => `gbfm:audio:position:${trackId}`

export interface AudioStorageShape {
  readPosition: (trackId: string) => Effect.Effect<number | null>
  writePosition: (trackId: string, time: number) => Effect.Effect<void>
  clear: (trackId: string) => Effect.Effect<void>
}

export class AudioStorage extends Context.Service<
  AudioStorage,
  AudioStorageShape
>()('@gbfm/www/AudioStorage') {}

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
