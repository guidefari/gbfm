import { AudioStorageError, PlayReporter, PlayerStorage } from '@gbfm/player'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { expect, test } from 'vitest'

import { makeMobilePlayReporterLayer } from './playTracker'

test('reports each new track once even when local play-dedup storage is unavailable', async () => {
  const calls: Array<string> = []

  const unavailableStorage = Layer.succeed(PlayerStorage, {
    loadQueue: Effect.succeed(null),
    saveQueue: () => Effect.void,
    loadVolume: Effect.succeed(null),
    saveVolume: () => Effect.void,
    loadPosition: () => Effect.succeed(null),
    savePosition: () => Effect.void,
    clearPosition: () => Effect.void,
    recordPlay: () => Effect.fail(new AudioStorageError('write')),
    isWithinDedupWindow: () => Effect.fail(new AudioStorageError('read')),
  })

  const layer = makeMobilePlayReporterLayer((trackId) =>
    Effect.sync(() => calls.push(trackId)),
  ).pipe(Layer.provideMerge(unavailableStorage))

  const runtime = ManagedRuntime.make(layer)

  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const reporter = yield* PlayReporter
        yield* reporter.recordPlay('track-1')
        yield* reporter.recordPlay('track-1')
        yield* reporter.recordPlay('track-2')
      }),
    )
  } finally {
    await runtime.dispose()
  }

  expect(calls).toEqual(['track-1', 'track-2'])
})
