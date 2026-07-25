import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { createPlayDelivery } from '@gbfm/player'

describe('audio play delivery', () => {
  test('delivers over the network when the local dedup read fails', async () => {
    const delivered: Array<string> = []
    const deliver = createPlayDelivery({
      isWithinDedupWindow: () => Effect.fail('storage unavailable'),
      deliver: (id) => Effect.sync(() => delivered.push(id)).pipe(Effect.asVoid),
      remember: () => Effect.void,
      now: () => 1_000
    })

    await Effect.runPromise(deliver('track-1'))

    expect(delivered).toEqual(['track-1'])
  })

  test('remembers successful delivery in memory when persistence fails', async () => {
    const delivered: Array<string> = []
    const deliver = createPlayDelivery({
      isWithinDedupWindow: () => Effect.succeed(false),
      deliver: (id) => Effect.sync(() => delivered.push(id)).pipe(Effect.asVoid),
      remember: () => Effect.fail('storage unavailable'),
      now: () => 1_000
    })

    await Effect.runPromise(deliver('track-1'))
    await Effect.runPromise(deliver('track-1'))

    expect(delivered).toEqual(['track-1'])
  })
})
