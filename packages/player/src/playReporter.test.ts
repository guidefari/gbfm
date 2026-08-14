/* oxlint-disable effecttsgo/strict-effect-provide -- Each test invokes Effect.runPromise, making it an Effect application entry point. */
import { makePlayReporterLayer, PlayReporter, PlayerStorageInMemory } from '@gbfm/player'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'

describe('makePlayReporterLayer', () => {
  it('delivers a fresh play once and dedups within the window', async () => {
    const recorded: string[] = []
    const layer = makePlayReporterLayer((trackId) =>
      Effect.sync(() => {
        recorded.push(trackId)
      })
    ).pipe(Layer.provideMerge(PlayerStorageInMemory))

    await Effect.gen(function* () {
      const reporter = yield* PlayReporter
      yield* reporter.recordPlay('track-1')
      yield* reporter.recordPlay('track-1')
    }).pipe(Effect.provide(layer), Effect.runPromise)

    expect(recorded).toEqual(['track-1'])
  })

  it('swallows deliver failures so playback is not interrupted', async () => {
    let delivered = false
    const layer = makePlayReporterLayer(() => {
      delivered = true
      return Effect.fail('network')
    }).pipe(Layer.provideMerge(PlayerStorageInMemory))

    await Effect.gen(function* () {
      const reporter = yield* PlayReporter
      yield* reporter.recordPlay('track-1')
    }).pipe(Effect.provide(layer), Effect.runPromise)

    expect(delivered).toBe(true)
  })
})
