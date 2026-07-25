import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import type { PersistedQueueType } from './persistedQueue'
import type { AudioStorageAdapter } from './audioStorage'
import { createAudioStorage } from './audioStorage'

export type PositionRecord = { readonly position: number; readonly updatedAt: number }

export interface PlayerStorageShape {
  readonly loadQueue: () => Effect.Effect<PersistedQueueType | null, unknown>
  readonly saveQueue: (queue: PersistedQueueType) => Effect.Effect<void, unknown>
  readonly loadPosition: (trackId: string) => Effect.Effect<PositionRecord | null, unknown>
  readonly savePosition: (trackId: string, position: number) => Effect.Effect<void, unknown>
  readonly clearPosition: (trackId: string) => Effect.Effect<void, unknown>
  readonly recordPlay: (trackId: string) => Effect.Effect<void, unknown>
  readonly isWithinDedupWindow: (trackId: string) => Effect.Effect<boolean, unknown>
}

export class PlayerStorage extends Context.Service<PlayerStorage, PlayerStorageShape>()(
  '@gbfm/player/PlayerStorage'
) {}

/** Builds a PlayerStorage layer from a platform storage adapter: expo-file-system
 *  on native, localStorage on web. */
export const layerFromAdapter = (adapter: AudioStorageAdapter, now: () => number = Date.now) =>
  Layer.sync(PlayerStorage, () => createAudioStorage(adapter, now))

export const loadQueue = Effect.andThen(PlayerStorage, (storage) => storage.loadQueue())

export const saveQueue = (queue: PersistedQueueType) =>
  Effect.andThen(PlayerStorage, (storage) => storage.saveQueue(queue))

export const loadPosition = (trackId: string) =>
  Effect.andThen(PlayerStorage, (storage) => storage.loadPosition(trackId))

export const savePosition = (trackId: string, position: number) =>
  Effect.andThen(PlayerStorage, (storage) => storage.savePosition(trackId, position))

export const clearPosition = (trackId: string) =>
  Effect.andThen(PlayerStorage, (storage) => storage.clearPosition(trackId))

export const recordPlay = (trackId: string) =>
  Effect.andThen(PlayerStorage, (storage) => storage.recordPlay(trackId))

export const isWithinDedupWindow = (trackId: string) =>
  Effect.andThen(PlayerStorage, (storage) => storage.isWithinDedupWindow(trackId))

/** Binds the PlayerStorage service to a concrete context so the player core,
 *  which runs effects itself, can call storage without carrying requirements. */
export const providePlayerStorage = (storage: PlayerStorageShape) => ({
  loadPosition: (trackId: string) => storage.loadPosition(trackId),
  savePosition: (trackId: string, position: number) => storage.savePosition(trackId, position),
  clearPosition: (trackId: string) => storage.clearPosition(trackId),
  loadQueue: () => storage.loadQueue(),
  saveQueue: (queue: PersistedQueueType) => storage.saveQueue(queue)
})

export const PlayerStorageInMemory = Layer.sync(PlayerStorage, () => {
  let queue: PersistedQueueType | null = null
  const positions = new Map<string, PositionRecord>()
  const plays = new Map<string, number>()
  const dedupWindowMs = 30 * 60 * 1000

  return {
    loadQueue: () => Effect.sync(() => queue),
    saveQueue: (next) =>
      Effect.sync(() => {
        queue = next
      }),
    loadPosition: (trackId) => Effect.sync(() => positions.get(trackId) ?? null),
    savePosition: (trackId, position) =>
      Effect.sync(() => {
        positions.set(trackId, { position, updatedAt: Date.now() })
      }),
    clearPosition: (trackId) =>
      Effect.sync(() => {
        positions.delete(trackId)
      }),
    recordPlay: (trackId) =>
      Effect.sync(() => {
        plays.set(trackId, Date.now())
      }),
    isWithinDedupWindow: (trackId) =>
      Effect.sync(() => {
        const last = plays.get(trackId)
        return last !== undefined && Date.now() - last < dedupWindowMs
      })
  }
})

export const PlayerStorageTest = Layer.succeed(PlayerStorage, {
  loadQueue: () => Effect.succeed(null),
  saveQueue: () => Effect.void,
  loadPosition: () => Effect.succeed(null),
  savePosition: () => Effect.void,
  clearPosition: () => Effect.void,
  recordPlay: () => Effect.void,
  isWithinDedupWindow: () => Effect.succeed(false)
})
