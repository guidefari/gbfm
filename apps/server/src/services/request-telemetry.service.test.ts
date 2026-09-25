import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'

import { RequestTelemetry, RequestTelemetryLive } from './request-telemetry.service'

describe('RequestTelemetryLive', () => {
  test('writes only the bounded request dimensions used by SLO queries', async () => {
    const points: Array<unknown> = []
    const layer = RequestTelemetryLive({
      release: 'release-1',
      stage: 'prod',
      writer: { writeDataPoint: (point) => points.push(point) },
    })

    await Effect.runPromise(
      Effect.gen(function* () {
        const telemetry = yield* RequestTelemetry
        yield* telemetry.record({
          method: 'GET',
          route: '/api/shows/:slug',
          status: 200,
          durationMs: 125,
        })
      }).pipe(Effect.provide(layer)),
    )

    expect(points).toEqual([
      {
        indexes: ['request'],
        blobs: ['release-1', 'prod', 'GET', '/api/shows/:slug', 'api'],
        doubles: [125, 200],
      },
    ])
  })
})
