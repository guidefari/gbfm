import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { type AudioStorageError, type PersistedQueueType } from './persistedQueue'
import type { AudioStorageAdapter, VolumeRecordType } from './audioStorage'
import { createAudioStorage } from './audioStorage'

export type PositionRecord = { readonly position: number; readonly updatedAt: number }

export interface PlayerStorageContract {
  readonly loadQueue: Effect.Effect<PersistedQueueType | null, AudioStorageError>
  readonly saveQueue: (queue: PersistedQueueType) => Effect.Effect<void, AudioStorageError>
  readonly loadVolume: Effect.Effect<VolumeRecordType | null, AudioStorageError>
  readonly saveVolume: (volume: VolumeRecordType) => Effect.Effect<void, AudioStorageError>
  readonly loadPosition: (
    trackId: string
  ) => Effect.Effect<PositionRecord | null, AudioStorageError>
  readonly savePosition: (
    trackId: string,
    position: number
  ) => Effect.Effect<void, AudioStorageError>
  readonly clearPosition: (trackId: string) => Effect.Effect<void, AudioStorageError>
  readonly recordPlay: (trackId: string) => Effect.Effect<void, AudioStorageError>
  readonly isWithinDedupWindow: (trackId: string) => Effect.Effect<boolean, AudioStorageError>
}

export class PlayerStorage extends Context.Service<PlayerStorage, PlayerStorageContract>()(
  '@gbfm/player/PlayerStorage'
) {}

/** Builds a PlayerStorage layer from a platform storage adapter: expo-file-system
 *  on native, localStorage on web. */
export const layerFromAdapter = (adapter: AudioStorageAdapter, now: () => number = Date.now) =>
  Layer.sync(PlayerStorage, () => {
    const storage = createAudioStorage(adapter, now)
    return {
      ...storage,
      loadQueue: storage.loadQueue(),
      loadVolume: storage.loadVolume()
    }
  })

export const loadQueue = Effect.andThen(PlayerStorage, (storage) => storage.loadQueue)

export const saveQueue = (queue: PersistedQueueType) =>
  Effect.andThen(PlayerStorage, (storage) => storage.saveQueue(queue))

export const loadVolume = Effect.andThen(PlayerStorage, (storage) => storage.loadVolume)

export const saveVolume = (volume: VolumeRecordType) =>
  Effect.andThen(PlayerStorage, (storage) => storage.saveVolume(volume))

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

export const PlayerStorageInMemory = Layer.sync(PlayerStorage, () => {
  let queue: PersistedQueueType | null = null
  const positions = new Map<string, PositionRecord>()
  const plays = new Map<string, number>()
  const dedupWindowMs = 30 * 60 * 1000

  let volume: VolumeRecordType | null = null

  return {
    loadQueue: Effect.sync(() => queue),
    saveQueue: (next) =>
      Effect.sync(() => {
        queue = next
      }),
    loadVolume: Effect.sync(() => volume),
    saveVolume: (next) =>
      Effect.sync(() => {
        volume = next
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
  loadQueue: Effect.succeed(null),
  saveQueue: () => Effect.void,
  loadVolume: Effect.succeed(null),
  saveVolume: () => Effect.void,
  loadPosition: () => Effect.succeed(null),
  savePosition: () => Effect.void,
  clearPosition: () => Effect.void,
  recordPlay: () => Effect.void,
  isWithinDedupWindow: () => Effect.succeed(false)
})
