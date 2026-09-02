import type { Fetcher, R2Bucket } from '@cloudflare/workers-types'
import { Data, Effect } from 'effect'
import { decodeQrPdfRequest, type QrPdfResponse } from './contract'
import { generateQrPdf, QrPdfGenerationError, type QrPdfDependencies } from './generator'

interface PdfGeneratorEnv {
  readonly ASSETS: Fetcher
  readonly USER_CONTENT: R2Bucket
  readonly CDN_ROUTER_URL: string
}

class InvalidQrPdfRequest extends Data.TaggedError('InvalidQrPdfRequest')<{
  readonly message: string
}> {}

type JsonResponseBody = QrPdfResponse | { readonly error: string }

const jsonResponse = (body: JsonResponseBody, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

const dependenciesFromEnv = (env: PdfGeneratorEnv): QrPdfDependencies => ({
  cdnUrl: env.CDN_ROUTER_URL.replace(/\/$/, ''),
  exists: (key) =>
    Effect.tryPromise({
      try: async () => (await env.USER_CONTENT.head(key)) !== null,
      catch: (error) => new QrPdfGenerationError({ message: String(error), stage: 'cache-read' })
    }),
  put: (key, bytes, contentType) =>
    Effect.tryPromise({
      try: async () => {
        await env.USER_CONTENT.put(key, bytes, { httpMetadata: { contentType } })
      },
      catch: (error) => new QrPdfGenerationError({ message: String(error), stage: 'cache-write' })
    }),
  loadFont: (name) =>
    Effect.tryPromise({
      try: async () => {
        const response = await env.ASSETS.fetch(new Request(`https://fonts.internal/${name}`))
        if (!response.ok) throw new Error(`Font asset ${name} returned ${response.status}`)
        return new Uint8Array(await response.arrayBuffer())
      },
      catch: (error) => new QrPdfGenerationError({ message: String(error), stage: 'font-read' })
    })
})

const handleRequest = (request: Request, env: PdfGeneratorEnv) =>
  Effect.gen(function* () {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const body = yield* Effect.tryPromise({
      try: async (): Promise<unknown> => request.json(),
      catch: () => new InvalidQrPdfRequest({ message: 'Request body must be JSON' })
    })
    const input = yield* decodeQrPdfRequest(body).pipe(
      Effect.mapError(() => new InvalidQrPdfRequest({ message: 'Request body is invalid' }))
    )
    const result = yield* generateQrPdf(dependenciesFromEnv(env), input)
    return jsonResponse(result)
  }).pipe(
    Effect.catchTag('InvalidQrPdfRequest', (error) =>
      Effect.succeed(jsonResponse({ error: error.message }, 400))
    ),
    Effect.catchTag('QrPdfGenerationError', (error) =>
      Effect.logError('QR PDF generation failed', { stage: error.stage }).pipe(
        Effect.as(jsonResponse({ error: 'QR PDF generation failed' }, 500))
      )
    )
  )

export default {
  fetch: (request: Request, env: PdfGeneratorEnv) => Effect.runPromise(handleRequest(request, env))
}
