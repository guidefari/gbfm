import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { describe, expect, test } from 'vitest'
import { cancelProgram } from './service'
import { ResumableUploadStorage, ResumableUploadStorageInMemory } from './storage'
import type { PersistedResumableUpload } from '@/lib/upload/resumable-upload'

const makePersisted = (
  overrides: Partial<PersistedResumableUpload> = {}
): PersistedResumableUpload => ({
  fileFingerprint: '123:track.mp3:1',
  uploadId: 'upload-1',
  key: 'user/audio_123_track.mp3',
  chunkSize: 5_000_000,
  totalBytes: 12_000_000,
  totalParts: 3,
  contentType: 'audio/mpeg',
  fileName: 'track.mp3',
  completedParts: [
    { partNumber: 1, etag: 'etag-1', size: 5_000_000 },
    { partNumber: 2, etag: 'etag-2', size: 5_000_000 }
  ],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_500,
  ...overrides
})

const buildTestLayer = () => {
  const store = new Map<string, PersistedResumableUpload>()
  return Layer.succeed(ResumableUploadStorage, {
    read: (fingerprint: string) => Effect.sync(() => store.get(fingerprint) ?? null),
    write: (value: PersistedResumableUpload) =>
      Effect.sync(() => {
        store.set(value.fileFingerprint, value)
      }),
    clear: (fingerprint: string) =>
      Effect.sync(() => {
        store.delete(fingerprint)
      })
  })
}

const runWith = <A, E>(
  layer: Layer.Layer<ResumableUploadStorage>,
  effect: Effect.Effect<A, E, ResumableUploadStorage>
) => Effect.runPromise(Effect.provide(effect, layer))

describe('ResumableUploadStorage in-memory', () => {
  test('returns null for an unknown fingerprint', async () => {
    const layer = buildTestLayer()
    const result = await runWith(
      layer,
      Effect.andThen(ResumableUploadStorage, (storage) => storage.read('missing'))
    )
    expect(result).toBeNull()
  })

  test('round-trips a persisted upload', async () => {
    const layer = buildTestLayer()
    const persisted = makePersisted()
    const result = await runWith(
      layer,
      Effect.gen(function* () {
        const storage = yield* ResumableUploadStorage
        yield* storage.write(persisted)
        return yield* storage.read(persisted.fileFingerprint)
      })
    )
    expect(result).toEqual(persisted)
  })

  test('clears a persisted upload', async () => {
    const layer = buildTestLayer()
    const persisted = makePersisted()
    const result = await runWith(
      layer,
      Effect.gen(function* () {
        const storage = yield* ResumableUploadStorage
        yield* storage.write(persisted)
        yield* storage.clear(persisted.fileFingerprint)
        return yield* storage.read(persisted.fileFingerprint)
      })
    )
    expect(result).toBeNull()
  })

  test('ResumableUploadStorageInMemory is also usable', async () => {
    const layer = ResumableUploadStorageInMemory
    const persisted = makePersisted({ fileFingerprint: 'abc' })
    const result = await runWith(
      layer,
      Effect.gen(function* () {
        const storage = yield* ResumableUploadStorage
        yield* storage.write(persisted)
        return yield* storage.read(persisted.fileFingerprint)
      })
    )
    expect(result?.uploadId).toBe('upload-1')
  })

  test('cancel clears the checkpoint even when remote abort is already canceled', async () => {
    const layer = buildTestLayer()
    const persisted = makePersisted()
    const controller = new AbortController()
    controller.abort()

    const result = await runWith(
      layer,
      Effect.gen(function* () {
        const storage = yield* ResumableUploadStorage
        yield* storage.write(persisted)
        yield* cancelProgram(persisted, controller.signal)
        return yield* storage.read(persisted.fileFingerprint)
      })
    )

    expect(result).toBeNull()
  })
})
