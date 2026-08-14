/* oxlint-disable effecttsgo/strict-effect-provide -- Each test invokes Effect.runPromise, making it an Effect application entry point. */
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { describe, expect, test } from 'vitest'
import { MixUploadDraftStorage, MixUploadDraftStorageInMemory } from './storage'
import { type MixUploadDraft, emptyMixUploadDraft } from './types'

const runWith = <A, E>(
  layer: Layer.Layer<MixUploadDraftStorage>,
  effect: Effect.Effect<A, E, MixUploadDraftStorage>
) => Effect.runPromise(Effect.provide(effect, layer))

describe('MixUploadDraftStorage in-memory', () => {
  test('stores a draft until it is cleared', async () => {
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
    const lifecycle = await runWith(
      MixUploadDraftStorageInMemory,
      Effect.gen(function* () {
        const storage = yield* MixUploadDraftStorage
        const beforeWrite = yield* storage.read
        yield* storage.write(draft)
        const afterWrite = yield* storage.read
        yield* storage.clear
        const afterClear = yield* storage.read
        return { beforeWrite, afterWrite, afterClear }
      })
    )

    expect(lifecycle).toEqual({ beforeWrite: null, afterWrite: draft, afterClear: null })
  })
})
