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

  it('parses import and sync mutation responses instead of reporting malformed success', async () => {
    const imported = {
      status: 'Imported',
      playlistId: 'p1',
      trackCount: 9,
      createdTrackCount: 2,
      reusedTrackCount: 7,
      enrichmentStatus: 'Unavailable',
    }

    const fetcher: typeof fetch = async (input) =>
      Response.json(
        input instanceof URL && input.pathname.endsWith('/import/spotify')
          ? imported
          : { status: 'Completed' },
      )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const context = yield* Layer.build(makeDashboardServiceLayer(fetcher))
        const service = Context.get(context, DashboardService)

        const document = yield* service.request({
          path: '/api/music/playlists/import/spotify',
          method: 'POST',
          body: '{}',
        })

        const error = yield* service
          .request({ path: '/api/music/playlists/p1/sync-links', method: 'POST' })
          .pipe(Effect.flip)

        return { document, error }
      }).pipe(Effect.scoped),
    )

    expect(result.document.playlistImport).toEqual(imported)
    expect(result.error).toBeInstanceOf(DashboardRequestError)
  })
})
