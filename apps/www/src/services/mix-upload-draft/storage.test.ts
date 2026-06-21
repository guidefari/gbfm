import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { describe, expect, test } from 'vitest'
import { MixUploadDraftStorage, MixUploadDraftStorageInMemory } from './storage'
import { type MixUploadDraft, emptyMixUploadDraft } from './types'

const buildTestLayer = () => {
  let stored: MixUploadDraft | null = null
  return Layer.succeed(MixUploadDraftStorage, {
    read: () => Effect.sync(() => stored),
    write: (value: MixUploadDraft) =>
      Effect.sync(() => {
        stored = value
      }),
    clear: () =>
      Effect.sync(() => {
        stored = null
      })
  })
}

const runWith = <A, E>(
  layer: Layer.Layer<MixUploadDraftStorage>,
  effect: Effect.Effect<A, E, MixUploadDraftStorage>
) => Effect.runPromise(Effect.provide(effect, layer))

describe('MixUploadDraftStorage in-memory', () => {
  test('returns null when no draft is stored', async () => {
    const result = await runWith(
      buildTestLayer(),
      Effect.andThen(MixUploadDraftStorage, (storage) => storage.read())
    )
    expect(result).toBeNull()
  })

  test('round-trips a draft', async () => {
    const layer = buildTestLayer()
    const draft: MixUploadDraft = {
      ...emptyMixUploadDraft(),
      title: 'My Mix',
      description: 'Cool mix',
      slug: 'my-mix',
      content: '# Hello',
      thumbnailUrl: 'https://example.com/x.jpg',
      tags: ['house', 'tech'],
      tracklist: [{ id: 1, time: 30, title: 'Track 1' }],
      url: 'https://example.com/audio.mp3',
      updatedAt: 1234
    }
    const result = await runWith(
      layer,
      Effect.gen(function* () {
        const storage = yield* MixUploadDraftStorage
        yield* storage.write(draft)
        return yield* storage.read()
      })
    )
    expect(result).toEqual(draft)
  })

  test('clears a draft', async () => {
    const layer = buildTestLayer()
    const draft: MixUploadDraft = { ...emptyMixUploadDraft(), title: 't', updatedAt: 1 }
    const result = await runWith(
      layer,
      Effect.gen(function* () {
        const storage = yield* MixUploadDraftStorage
        yield* storage.write(draft)
        yield* storage.clear()
        return yield* storage.read()
      })
    )
    expect(result).toBeNull()
  })

  test('MixUploadDraftStorageInMemory is also usable', async () => {
    const draft: MixUploadDraft = { ...emptyMixUploadDraft(), title: 't', updatedAt: 5 }
    const result = await runWith(
      MixUploadDraftStorageInMemory,
      Effect.gen(function* () {
        const storage = yield* MixUploadDraftStorage
        yield* storage.write(draft)
        return yield* storage.read()
      })
    )
    expect(result?.title).toBe('t')
  })
})
