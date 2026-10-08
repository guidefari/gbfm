import { Cause, Context, Effect, Layer, Logger } from 'effect'
import * as FileSystem from 'effect/FileSystem'
import { HttpRouter, HttpServer, HttpServerError, HttpServerResponse } from 'effect/http'
import * as Path from 'effect/Path'
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
    logging: Layer.Layer<never> = Layer.empty,
    waiting: Effect.Effect<void> = Effect.void,
  ) =>
    HttpRouter.toWebHandler(
      Layer.mergeAll(
        HttpRouter.add('GET', '/probe', HttpServerResponse.text('ok')),
        HttpRouter.add('GET', '/waiting', waiting.pipe(Effect.andThen(Effect.never))),
        HttpRouter.add<HttpServerError.HttpServerError>('POST', '/parse', (request) =>
          request.json.pipe(Effect.as(HttpServerResponse.empty())),
        ),
        HttpRouter.add('GET', '/failure', Effect.fail({ message: 'private-failure-message' })),
        HttpRouter.add('GET', '/defect', Effect.die(new Error('private-defect-message'))),
        HttpRouter.add('GET', '/server-abort', Effect.interrupt),
        HttpRouter.add(
          'GET',
          '/client-abort',
          Effect.failCause(
            Cause.annotate(Cause.interrupt(), HttpServerError.ClientAbort.annotation),
          ),
        ),
        RequestLoggerLive,
        requestTelemetry,
      ).pipe(
        Layer.provideMerge(logging),
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

  test.each([
    { path: '/missing', method: 'GET', status: 404, level: 'Info', outcome: 'success' },
    { path: '/parse', method: 'POST', status: 400, level: 'Info', outcome: 'success' },
    { path: '/failure', method: 'GET', status: 500, level: 'Error', outcome: 'failure' },
    { path: '/defect', method: 'GET', status: 500, level: 'Error', outcome: 'failure' },
    { path: '/server-abort', method: 'GET', status: 503, level: 'Error', outcome: 'failure' },
    { path: '/client-abort', method: 'GET', status: 499, level: 'Info', outcome: 'client_abort' },
  ])(
    'records the actual $status response for $path',
    async ({ path, method, status, level, outcome }) => {
      const points: Array<RequestTelemetryPoint> = []
      const logs: Array<Pick<Logger.Options<unknown>, 'message' | 'cause' | 'logLevel'>> = []

      const telemetry = Layer.succeed(RequestTelemetry, {
        release: 'release-1',
        stage: 'test',
        record: (point) => Effect.sync(() => points.push(point)),
      })

      const logging = Logger.layer([
        Logger.make(({ message, cause, logLevel }) => logs.push({ message, cause, logLevel })),
      ])

      const handler = loggedHandler(telemetry, logging)

      try {
        const init: RequestInit = {
          method,
          headers: {
            'x-request-id': 'failed-request-1',
            authorization: 'Bearer private-header-value',
          },
        }

        if (method === 'POST') init.body = '{invalid-json'

        const response = await handler.handler(
          new Request(`http://localhost${path}?query=private-query-value`, init),
          Context.make(Database, db),
        )

        expect(response.status).toBe(status)
        expect(points).toHaveLength(1)
        expect(points[0]).toMatchObject({
          method,
          route: path === '/missing' ? '/unmatched' : path,
          requestId: 'failed-request-1',
          status,
        })
        expect(logs).toHaveLength(1)
        expect(logs[0]).toMatchObject({ logLevel: level })
        expect(logs[0]?.message).toEqual([
          status === 499 ? '[HTTP] client aborted request' : '[HTTP] request failed',
          expect.objectContaining({
            status,
            outcome,
            requestId: 'failed-request-1',
            release: 'release-1',
          }),
        ])
      } finally {
        await handler.dispose()
      }
    },
  )

  test('records a real request cancellation as 499 after the handler starts', async () => {
    const started = Promise.withResolvers<void>()
    const points: Array<RequestTelemetryPoint> = []

    const handler = loggedHandler(
      Layer.succeed(RequestTelemetry, {
        release: 'release-1',
        stage: 'test',
        record: (point) => Effect.sync(() => points.push(point)),
      }),
      Logger.layer([]),
      Effect.sync(() => started.resolve()),
    )

    const controller = new AbortController()

    try {
      const pendingResponse = handler.handler(
        new Request('http://localhost/waiting', {
          signal: controller.signal,
          headers: { 'x-request-id': 'cancelled-request-1' },
        }),
        Context.make(Database, db),
      )

      await started.promise
      controller.abort()

      const response = await pendingResponse
      expect(response.status).toBe(499)
      expect(points).toHaveLength(1)
      expect(points[0]).toMatchObject({
        route: '/waiting',
        status: 499,
        requestId: 'cancelled-request-1',
      })
    } finally {
      controller.abort()
      await handler.dispose()
    }
  })

  test.each([
    { path: '/private-path', status: 404 },
    { path: '/parse', status: 400 },
    { path: '/failure', status: 500 },
    { path: '/defect', status: 500 },
  ])(
    'does not serialize request or error payloads into failure logs for $path',
    async ({ path, status }) => {
      const logs: Array<Pick<Logger.Options<unknown>, 'message' | 'cause' | 'logLevel'>> = []

      const handler = loggedHandler(
        RequestTelemetryUnavailableLayer,
        Logger.layer([
          Logger.make(({ message, cause, logLevel }) => logs.push({ message, cause, logLevel })),
        ]),
      )

      try {
        const init: RequestInit = {
          method: path === '/parse' ? 'POST' : 'GET',
          headers: {
            'x-request-id': 'privacy-request-1',
            authorization: 'Bearer private-authorization-value',
            cookie: 'session=private-cookie-value',
            'x-forwarded-for': '192.0.2.42',
          },
        }

        if (path === '/parse') init.body = '{private-body-value'

        await handler.handler(
          new Request(`http://localhost${path}?query=private-query-value`, init),
          Context.make(Database, db),
        )

        expect(logs).toHaveLength(1)
        const serialized = JSON.stringify(logs)
        expect(serialized).toContain('privacy-request-1')
        expect(serialized).not.toMatch(/private-|192\.0\.2\.42|localhost|authorization|cookie/)
        expect(logs[0]?.message).toEqual([
          '[HTTP] request failed',
          {
            method: init.method,
            route: path === '/private-path' ? '/unmatched' : path,
            requestId: 'privacy-request-1',
            status,
            duration: expect.any(Number),
            failureKinds: [path === '/defect' ? 'Die' : 'Fail'],
            outcome: status >= 500 ? 'failure' : 'success',
            release: 'local',
            service: 'api',
          },
        ])
        expect(logs[0]?.cause.reasons).toEqual([])
      } finally {
        await handler.dispose()
      }
    },
  )
})
