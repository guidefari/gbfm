import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  PlaylistEnrichmentQueue,
  PlaylistEnrichmentQueueLayer,
  type PlaylistEnrichmentJob
} from './playlist-enrichment-queue'
import { withTestLayer } from '@/test/effect'

describe('PlaylistEnrichmentQueue', () => {
  test('reports acceptance only after the queue sender accepts the job', async () => {
    const sent: PlaylistEnrichmentJob[] = []
    const job: PlaylistEnrichmentJob = {
      _tag: 'PlaylistEnrichmentJob',
      playlistId: 'playlist-1',
      reason: 'manual'
    }
    const layer = PlaylistEnrichmentQueueLayer({
      send: async (message) => {
        sent.push(message)
      }
    })

    await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const queue = yield* PlaylistEnrichmentQueue
          yield* queue.enqueue(job)
        }),
        layer
      )
    )

    expect(sent).toEqual([job])
  })

  test('exposes queue rejection as a typed unavailable failure', async () => {
    const layer = PlaylistEnrichmentQueueLayer({
      send: () => Promise.reject(new Error('private queue failure'))
    })

    const error = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const queue = yield* PlaylistEnrichmentQueue
          return yield* queue.enqueue({
            _tag: 'PlaylistEnrichmentJob',
            playlistId: 'playlist-1',
            reason: 'after_import'
          })
        }),
        layer
      ).pipe(Effect.flip)
    )

    expect(error).toMatchObject({
      _tag: 'PlaylistEnrichmentQueueUnavailable',
      playlistId: 'playlist-1'
    })
  })
})
