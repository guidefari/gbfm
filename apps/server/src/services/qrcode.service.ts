import {
  decodeQrPdfResponse,
  type QrPdfRequest,
  type QrPdfResponse
} from '@gbfm/pdf-generator/contract'
import { Context, Effect, Layer } from 'effect'
import { DatabaseError, getErrorMessage } from '@/errors'

interface MixData {
  slug: string
  title: string
  thumbnailUrl?: string | null
  creators?: Array<{ name: string }>
}

interface ShowData {
  slug: string
  title: string
  thumbnailUrl?: string | null
  hosts?: Array<{ name: string }>
}

export interface QRCodeService {
  readonly generateMixQRPdf: (
    mix: MixData
  ) => Effect.Effect<{ url: string; cached: boolean }, DatabaseError>
  readonly generateShowQRPdf: (
    show: ShowData
  ) => Effect.Effect<{ url: string; cached: boolean }, DatabaseError>
}

export const QRCodeService = Context.Service<QRCodeService>('QRCodeService')

export interface QrPdfFetcher {
  readonly fetch: (request: Request) => PromiseLike<{
    readonly ok: boolean
    readonly status: number
    readonly json: () => Promise<unknown>
  }>
}

const requestQrPdf = (fetcher: QrPdfFetcher, input: QrPdfRequest) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetcher.fetch(
        new Request('https://qr-pdf.internal/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input)
        })
      )
      if (!response.ok) throw new Error(`QR PDF Worker returned ${response.status}`)
      const body: unknown = await response.json()
      return await Effect.runPromise(decodeQrPdfResponse(body))
    },
    catch: (error) =>
      new DatabaseError({
        message: `Failed to generate QR PDF: ${getErrorMessage(error)}`,
        operation: 'generate',
        table: 'pdf'
      })
  })

const withGenerationSpan = (slug: string, effect: Effect.Effect<QrPdfResponse, DatabaseError>) =>
  effect.pipe(
    Effect.withSpan('qrcode.generatePdf', {
      attributes: { slug }
    })
  )

export const QRCodeServiceLayer = (fetcher: QrPdfFetcher) =>
  Layer.succeed(QRCodeService, {
    generateMixQRPdf: (mix) =>
      withGenerationSpan(
        mix.slug,
        requestQrPdf(fetcher, {
          kind: 'mix',
          slug: mix.slug,
          title: mix.title,
          people: (mix.creators ?? []).map(({ name }) => name)
        })
      ),
    generateShowQRPdf: (show) =>
      withGenerationSpan(
        show.slug,
        requestQrPdf(fetcher, {
          kind: 'show',
          slug: show.slug,
          title: show.title,
          people: (show.hosts ?? []).map(({ name }) => name)
        })
      )
  })

const unavailable = (kind: 'mix' | 'show') =>
  Effect.fail(
    new DatabaseError({
      message: `QR PDF generation is unavailable for ${kind}`,
      operation: 'generate',
      table: 'pdf'
    })
  )

export const QRCodeServiceUnavailableLayer = Layer.succeed(QRCodeService, {
  generateMixQRPdf: () => unavailable('mix'),
  generateShowQRPdf: () => unavailable('show')
})
