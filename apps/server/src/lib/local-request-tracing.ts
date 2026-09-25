import { Effect, Layer, ManagedRuntime, Tracer } from 'effect'
import { FetchHttpClient, HttpServerRequest } from 'effect/unstable/http'
import type { HttpServerResponse } from 'effect/unstable/http'
import { OtlpExporter, OtlpSerialization, OtlpTracer } from 'effect/unstable/observability'

const LocalTracer = OtlpTracer.layer({
  url: 'http://127.0.0.1:4318/v1/traces',
  resource: { serviceName: 'goosebumps-fm-api' },
  exportInterval: '250 millis',
}).pipe(Layer.provide(OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer))

const runtime = ManagedRuntime.make(LocalTracer)

export const localTracer = () => runtime.runPromise(Tracer.Tracer)

const remoteParent = (header: string | null) => {
  const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(header ?? '')
  const traceId = match?.[1]
  const spanId = match?.[2]
  const flags = match?.[3]

  if (!traceId || !spanId || !flags || /^0+$/.test(traceId) || /^0+$/.test(spanId)) return undefined

  return Tracer.externalSpan({
    traceId,
    spanId,
    sampled: (Number.parseInt(flags, 16) & 1) !== 0,
  })
}

export const traceLocalRequest = (
  run: () => Promise<Response>,
  waitUntil: (promise: Promise<unknown>) => void,
) => {
  return run().finally(() => {
    waitUntil(
      runtime.runPromise(
        Effect.flatMap(OtlpExporter.Flusher, (flusher) =>
          Effect.timeoutOption(flusher.flush, '2 seconds'),
        ),
      ),
    )
  })
}

export const localRequestMiddleware = <E, R>(
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const path = new URL(request.url, 'http://localhost').pathname
    const requestId = request.headers['x-request-id']
    const parent = remoteParent(request.headers.traceparent ?? null)

    return yield* effect.pipe(
      Effect.tap((response) =>
        Effect.annotateCurrentSpan('http.response.status_code', response.status),
      ),
      Effect.withSpan(`api ${request.method} ${path}`, {
        ...(parent ? { parent } : undefined),
        attributes: {
          'http.request.method': request.method,
          'url.path': path,
          ...(requestId && /^[a-zA-Z0-9_-]{1,128}$/.test(requestId)
            ? { 'gbfm.request_id': requestId }
            : undefined),
        },
      }),
    )
  })
