import { Context, Effect, Layer } from 'effect'
import * as FileSystem from 'effect/FileSystem'
import * as Path from 'effect/Path'
import { HttpRouter, HttpServer, HttpServerResponse } from 'effect/unstable/http'
import { describe, expect, test } from 'vitest'

import { Database } from '@/db/layer'
import {
  RequestTelemetry,
  RequestTelemetryUnavailableLayer,
  type RequestTelemetryPoint,
} from '@/services/request-telemetry.service'
import { DatabaseTestLayer, db } from '@/test/database'

import { requestPath, RequestLoggerLive } from './global-middleware'

describe('requestPath', () => {
  test('parses relative request URLs from the Bun adapter', () => {
    expect(requestPath('/api/content/audio/mix?limit=18&offset=0')).toBe('/api/content/audio/mix')
  })

  test('parses absolute request URLs', () => {
    expect(requestPath('http://localhost/health/live')).toBe('/health/live')
  })
})

describe('RequestLoggerLive', () => {
  // Regression: this middleware is global, so parsing request.url without a
  // base turned every single request into a 500 once the server saw a
  // relative request target.
  const loggedHandler = (
    requestTelemetry: Layer.Layer<RequestTelemetry> = RequestTelemetryUnavailableLayer,
  ) =>
    HttpRouter.toWebHandler(
      Layer.mergeAll(
        HttpRouter.add('GET', '/probe', HttpServerResponse.text('ok')),
        RequestLoggerLive,
        requestTelemetry,
      ).pipe(
        Layer.provide(HttpRouter.disableLogger),
        Layer.provideMerge(
          Layer.mergeAll(FileSystem.layerNoop({}), Path.layer).pipe(
            Layer.provideMerge(HttpServer.layerServices),
          ),
        ),
        Layer.provide(DatabaseTestLayer),
      ),
      { disableLogger: true },
    )

  test('passes the response through for an absolute request url', async () => {
    const res = await loggedHandler().handler(
      new Request('http://localhost/probe', { headers: { 'x-request-id': 'request-1' } }),
      Context.make(Database, db),
    )

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  test('passes the response through for a relative request target', async () => {
    const request = new Request('http://localhost/probe', {
      headers: { 'x-request-id': 'request-1' },
    })

    Object.defineProperty(request, 'url', { value: '/probe' })

    const res = await loggedHandler().handler(request, Context.make(Database, db))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  test('records a bounded route template instead of the request URL', async () => {
    const points: Array<RequestTelemetryPoint> = []

    const telemetry = Layer.succeed(RequestTelemetry, {
      release: 'release-1',
      stage: 'test',
      record: (point) => Effect.sync(() => points.push(point)),
    })

    const request = new Request('http://localhost/probe?secret=private', {
      headers: { 'x-request-id': 'request-1' },
    })

    const response = await loggedHandler(telemetry).handler(request, Context.make(Database, db))

    expect(response.status).toBe(200)
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ method: 'GET', route: '/probe', status: 200 })
    expect(JSON.stringify(points)).not.toContain('secret')
    expect(JSON.stringify(points)).not.toContain('private')
  })
})
