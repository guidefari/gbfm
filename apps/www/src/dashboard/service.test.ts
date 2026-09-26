import { Context, Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'

import { DashboardRequestError, DashboardService, makeDashboardServiceLayer } from './service'

describe('dashboard transport', () => {
  it('sends authenticated same-origin requests through the service seam', async () => {
    const requests: Array<RequestInfo | URL> = []

    const fetcher: typeof fetch = async (input) => {
      requests.push(input)

      return new Response(JSON.stringify({ favorites: [], success: true, total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const context = yield* Layer.build(makeDashboardServiceLayer(fetcher))

        return yield* Context.get(context, DashboardService).request({ path: '/api/favorites' })
      }).pipe(Effect.scoped),
    )

    expect(result).toEqual({ rows: [], fields: {}, toggles: {} })
    expect(requests[0]).toEqual(new URL('http://localhost/api/favorites'))
  })

  it('rejects malformed success bodies rather than treating them as empty collections', async () => {
    const fetcher: typeof fetch = async () =>
      Response.json({ success: true, favorites: 'invalid', total: 1 })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const context = yield* Layer.build(makeDashboardServiceLayer(fetcher))

        return yield* Context.get(context, DashboardService).request({ path: '/api/favorites' })
      }).pipe(Effect.scoped, Effect.flip),
    )

    expect(result).toBeInstanceOf(DashboardRequestError)
  })
})
