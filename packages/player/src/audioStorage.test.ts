import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  createAudioStorage,
  createWebAudioStorageAdapter,
  type AudioStorageAdapter
} from './audioStorage'

const createMemoryAdapter = (): AudioStorageAdapter & {
  readonly values: Map<string, string>
} => {
  const values = new Map<string, string>()
  return {
    values,
    read: (key) => Promise.resolve(values.get(key) ?? null),
    write: (key, value) => {
      values.set(key, value)
      return Promise.resolve()
    },
    remove: (key) => {
      values.delete(key)
      return Promise.resolve()
    }
  }
}

describe('audio storage', () => {
  test('persists queue, position, and volume through the explicit adapter seam', async () => {
    const adapter = createMemoryAdapter()
    const storage = createAudioStorage(adapter, () => 123)
    const queue = { tracks: [], currentIndex: -1 } as const
    const volume = { volume: 42, isMuted: true } as const

    await Effect.runPromise(storage.saveQueue(queue))
    await Effect.runPromise(storage.savePosition('track/1', 42))
    await Effect.runPromise(storage.saveVolume(volume))

    expect(await Effect.runPromise(storage.loadQueue())).toEqual(queue)
    expect(await Effect.runPromise(storage.loadPosition('track/1'))).toEqual({
      position: 42,
      updatedAt: 123
    })
    expect(await Effect.runPromise(storage.loadVolume())).toEqual(volume)
    expect([...adapter.values.keys()]).toContain('gbfm-audio-volume.json')
  })

  test('uses browser storage without native file objects', async () => {
    const values = new Map<string, string>()
    const adapter = createWebAudioStorageAdapter({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    })
    const storage = createAudioStorage(adapter, () => 456)

    await Effect.runPromise(storage.saveVolume({ volume: 80, isMuted: false }))

    expect(await Effect.runPromise(storage.loadVolume())).toEqual({
      volume: 80,
      isMuted: false
    })
  })

  test('treats unavailable browser storage as empty during SSR', async () => {
    const storage = createAudioStorage(createWebAudioStorageAdapter(undefined))

    await Effect.runPromise(storage.saveQueue({ tracks: [], currentIndex: -1 }))

    expect(await Effect.runPromise(storage.loadQueue())).toBeNull()
  })
})
