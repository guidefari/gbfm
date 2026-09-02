import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { QRCodeService, QRCodeServiceLayer, type QrPdfFetcher } from './qrcode.service'

class RecordingQrPdfFetcher implements QrPdfFetcher {
  readonly requests: Request[] = []

  fetch(request: Request) {
    this.requests.push(request)
    return Promise.resolve(
      Response.json({
        url: 'https://cdn.goosebumps.fm/user-content/qr-pdfs/qr/example.pdf',
        cached: false
      })
    )
  }
}

describe('QRCodeServiceLayer', () => {
  test('projects mix data across the QR PDF Worker seam', async () => {
    const fetcher = new RecordingQrPdfFetcher()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* QRCodeService
        return yield* service.generateMixQRPdf({
          slug: 'example',
          title: 'Example Mix',
          creators: [{ name: 'Guide Fari' }]
        })
        // oxlint-disable-next-line effecttsgo/strict-effect-provide -- The test runner owns this Effect entry point.
      }).pipe(Effect.provide(QRCodeServiceLayer(fetcher)))
    )

    expect(result.cached).toBe(false)
    expect(fetcher.requests).toHaveLength(1)
    const request = fetcher.requests[0]
    if (request === undefined) throw new Error('Expected one recorded QR PDF request')
    expect(await request.json()).toEqual({
      kind: 'mix',
      slug: 'example',
      title: 'Example Mix',
      people: ['Guide Fari']
    })
  })

  test('rejects an invalid response from the runtime hop', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const service = yield* QRCodeService
        return yield* service.generateShowQRPdf({ slug: 'example', title: 'Example Show' })
      }).pipe(
        // oxlint-disable-next-line effecttsgo/strict-effect-provide -- The test runner owns this Effect entry point.
        Effect.provide(
          QRCodeServiceLayer({
            fetch: () => Promise.resolve(Response.json({ unexpected: true }))
          })
        )
      )
    )

    expect(exit._tag).toBe('Failure')
  })
})
