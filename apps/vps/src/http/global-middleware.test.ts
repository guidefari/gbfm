import * as BunFileSystem from '@effect/platform-bun/BunFileSystem'
import * as BunPath from '@effect/platform-bun/BunPath'
import { Context, Layer } from 'effect'
import { HttpRouter, HttpServer, HttpServerResponse } from 'effect/unstable/http'
import { describe, expect, test } from 'vitest'
import { Database } from '@/db/layer'
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
  const loggedHandler = () =>
    HttpRouter.toWebHandler(
      Layer.mergeAll(
        HttpRouter.add('GET', '/probe', HttpServerResponse.text('ok')),
        RequestLoggerLive
      ).pipe(
        Layer.provide(HttpRouter.disableLogger),
        Layer.provideMerge(
          Layer.mergeAll(BunFileSystem.layer, BunPath.layer).pipe(
            Layer.provideMerge(HttpServer.layerServices)
          )
        ),
        Layer.provide(DatabaseTestLayer)
      ),
      { disableLogger: true }
    )

  test('passes the response through for an absolute request url', async () => {
    const res = await loggedHandler().handler(
      new Request('http://localhost/probe'),
      Context.make(Database, db)
    )

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  test('passes the response through for a relative request target', async () => {
    const request = new Request('http://localhost/probe')
    Object.defineProperty(request, 'url', { value: '/probe' })

    const res = await loggedHandler().handler(request, Context.make(Database, db))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })
})
