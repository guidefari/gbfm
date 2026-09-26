import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'

import { withTestLayer } from '@/test/effect'

import {
  PlaylistEnrichmentQueue,
  PlaylistEnrichmentQueueLayer,
  PlaylistEnrichmentJob,
} from './playlist-enrichment-queue'

describe('PlaylistEnrichmentQueue', () => {
  test('reports acceptance only after the queue sender accepts the job', async () => {
    const sent: Array<PlaylistEnrichmentJob> = []

    const job = PlaylistEnrichmentJob.make({
      playlistId: 'playlist-1',
      reason: 'manual',
    })

    const layer = PlaylistEnrichmentQueueLayer({
      send: async (message) => {
        sent.push(message)
      },
    })

    await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const queue = yield* PlaylistEnrichmentQueue
          yield* queue.enqueue(job)
        }),
        layer,
      ),
    )

    expect(sent).toEqual([job])
  })

  test('exposes queue rejection as a typed unavailable failure', async () => {
    const layer = PlaylistEnrichmentQueueLayer({
      send: () => Promise.reject(new Error('private queue failure')),
    })

    const error = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const queue = yield* PlaylistEnrichmentQueue

          return yield* queue.enqueue(
            PlaylistEnrichmentJob.make({
              playlistId: 'playlist-1',
              reason: 'after_import',
            }),
          )
        }),
        layer,
      ).pipe(Effect.flip),
    )

    expect(error).toMatchObject({ playlistId: 'playlist-1' })
  })
})
