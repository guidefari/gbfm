import { Context, Effect, Layer } from 'effect'
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
      Effect.scoped(
        Effect.gen(function* () {
          const services = yield* Layer.build(layer)
          const telemetry = Context.get(services, RequestTelemetry)

          yield* telemetry.record({
            method: 'GET',
            route: '/api/shows/:slug',
            status: 200,
            durationMs: 125,
          })
        }),
      ),
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
