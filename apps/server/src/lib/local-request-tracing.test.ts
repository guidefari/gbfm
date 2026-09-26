import { OtelTracer, Resource } from '@effect/opentelemetry'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { Layer } from 'effect'
import { HttpRouter, HttpServerResponse } from 'effect/unstable/http'
import { describe, expect, test } from 'vitest'

import { LocalRouteTracingLive, localRequestMiddleware } from './local-request-tracing'

describe('local API request tracing', () => {
  test('names matched spans with the route template and keeps request correlation', async () => {
    const exporter = new InMemorySpanExporter()

    const provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    })

    provider.register()

    const tracing = OtelTracer.layerGlobal.pipe(
      Layer.provide(Resource.layer({ serviceName: 'local-request-tracing-test' })),
    )

    const routes = HttpRouter.add('GET', '/api/shows/:slug', HttpServerResponse.text('ok')).pipe(
      Layer.provide(LocalRouteTracingLive),
      Layer.provideMerge(tracing),
    )

    const handler = HttpRouter.toWebHandler(routes, {
      disableLogger: true,
      middleware: localRequestMiddleware,
    })

    try {
      for (const slug of ['first-show', 'second-show']) {
        const response = await handler.handler(
          new Request(`http://localhost/api/shows/${slug}`, {
            headers: { 'x-request-id': `request-${slug}` },
          }),
        )

        expect(response.status).toBe(200)
        expect(await response.text()).toBe('ok')
      }

      await provider.forceFlush()

      const spans = exporter.getFinishedSpans()
      const routeSpans = spans.filter((span) => span.name === 'api GET /api/shows/:slug')
      const requestSpans = spans.filter((span) => span.name === 'api.request')

      expect(routeSpans).toHaveLength(2)
      expect(routeSpans.map((span) => span.attributes['http.route'])).toEqual([
        '/api/shows/:slug',
        '/api/shows/:slug',
      ])
      expect(requestSpans.map((span) => span.attributes['gbfm.request_id'])).toEqual([
        'request-first-show',
        'request-second-show',
      ])
      expect(requestSpans).toHaveLength(2)
      expect(routeSpans.map((span) => span.parentSpanContext?.spanId)).toEqual(
        requestSpans.map((span) => span.spanContext().spanId),
      )
      expect(spans.map((span) => span.name).join(' ')).not.toMatch(/first-show|second-show/)
    } finally {
      await handler.dispose()
      await provider.shutdown()
    }
  })
})
