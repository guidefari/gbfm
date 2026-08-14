import { AudioStorageError, PlayReporter, PlayerStorage } from '@gbfm/player'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { expect, test, vi } from 'vitest'

type TrackAudioPlayRequest = { readonly params: { readonly id: string } }

const api = vi.hoisted<{ calls: Array<TrackAudioPlayRequest> }>(() => ({ calls: [] }))

vi.mock('@/api/client', async () => {
  const { Effect } = await import('effect')
  return {
    getApiClient: Effect.succeed({
      audio: {
        trackAudioPlay: (request: TrackAudioPlayRequest) =>
          Effect.sync(() => {
            api.calls.push(request)
          })
      }
    })
  }
})

const { PlayReporterLive } = await import('./playTracker')

test('reports each new track once even when local play-dedup storage is unavailable', async () => {
  api.calls.length = 0
  const unavailableStorage = Layer.succeed(PlayerStorage, {
    loadQueue: Effect.succeed(null),
    saveQueue: () => Effect.void,
    loadVolume: Effect.succeed(null),
    saveVolume: () => Effect.void,
    loadPosition: () => Effect.succeed(null),
    savePosition: () => Effect.void,
    clearPosition: () => Effect.void,
    recordPlay: () => Effect.fail(new AudioStorageError('write')),
    isWithinDedupWindow: () => Effect.fail(new AudioStorageError('read'))
  })
  const layer = PlayReporterLive.pipe(Layer.provideMerge(unavailableStorage))

  const runtime = ManagedRuntime.make(layer)
  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const reporter = yield* PlayReporter
        yield* reporter.recordPlay('track-1')
        yield* reporter.recordPlay('track-1')
        yield* reporter.recordPlay('track-2')
      })
    )
  } finally {
    await runtime.dispose()
  }

  expect(api.calls).toEqual([{ params: { id: 'track-1' } }, { params: { id: 'track-2' } }])
})
