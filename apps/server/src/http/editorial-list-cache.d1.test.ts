import { randomUUID } from 'node:crypto'

import { GetEditorialPostsResponse } from '@gbfm/api/post'
import { inArray } from 'drizzle-orm'
import { Effect, Layer, Schema } from 'effect'
import { afterAll, expect, test } from 'vitest'

import { postsTable } from '@/db/post.schema'
import { ExternalMediaFetcher } from '@/lib/external-media'
import {
  EditorialListCacheLayer,
  type EditorialCacheStorage,
} from '@/services/editorial-list-cache'
import { RequestTelemetry, type RequestTelemetryPoint } from '@/services/request-telemetry.service'
import { d1, db } from '@/test/database'
import { createTestWebHandler } from '@/test/http-handler'

const ids = Array.from({ length: 30 }, () => randomUUID())

afterAll(async () => {
  await db.delete(postsTable).where(inArray(postsTable.id, ids))
})

test('separate request handlers reuse public JSON without losing request telemetry or CORS', async () => {
  const stored = new Map<string, Response>()

  const storage: EditorialCacheStorage = {
    match: async (key) => stored.get(key)?.clone(),
    put: async (key, response) => {
      stored.set(key, response.clone())
    },
  }

  const providerRequests: Array<string> = []
  const telemetry: Array<RequestTelemetryPoint> = []
  const durations: Array<number> = []

  const fetcher = Layer.succeed(ExternalMediaFetcher, async (url) => {
    providerRequests.push(url)

    return new Response(
      '<html><head><meta name="bc-page-properties" content="{&quot;item_type&quot;:&quot;a&quot;,&quot;item_id&quot;:123}"></head></html>',
      { headers: { 'content-type': 'text/html' } },
    )
  })

  const requestTelemetry = Layer.succeed(RequestTelemetry, {
    release: 'test-release',
    stage: 'test',
    record: (point) =>
      Effect.sync(() => {
        telemetry.push(point)
      }),
  })

  for (const [index, id] of ids.entries()) {
    await db.insert(postsTable).values({
      id,
      title: `Editorial cache evidence ${index}`,
      slug: `editorial-cache-${id}`,
      type: 'post' as const,
      draft: false,
      createdAt: new Date(Date.UTC(2026, 0, 1) + index * 1000),
      content: Array.from(
        { length: 3 },
        (_, embed) => `https://fixture.bandcamp.com/album/cache-evidence-${index}-${embed}`,
      ).join('\n\n'),
    })
  }

  let requestScopes = 0

  const read = async (headers?: HeadersInit) => {
    requestScopes++

    const handler = createTestWebHandler(
      d1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      fetcher,
      {
        editorialListCache: EditorialListCacheLayer(storage, {
          origin: 'https://api.example.com',
          release: 'test-release',
        }),
        requestTelemetry,
      },
    )

    const start = performance.now()
    const requestHeaders = new Headers(headers)
    requestHeaders.set('origin', 'https://goosebumps.fm')

    try {
      return await handler.handler(
        new Request('https://api.example.com/api/content/posts/editorials?limit=20', {
          headers: requestHeaders,
        }),
      )
    } finally {
      durations.push(performance.now() - start)
      await handler.dispose()
    }
  }

  const first = await read({ 'x-request-id': 'editorial-miss' })
  const firstBody = await first.text()

  const decoded = Schema.decodeUnknownSync(Schema.fromJsonString(GetEditorialPostsResponse))(
    firstBody,
  )

  expect(decoded.data).toHaveLength(20)
  expect(decoded.pagination).toEqual({ total: 30, limit: 20, offset: 0, hasMore: true })
  expect(decoded.data.map((post) => post.id)).toEqual(ids.slice(10).toReversed())
  expect(decoded.data.every((post) => !post.draft)).toBe(true)
  const second = await read({ 'x-request-id': 'editorial-hit' })

  expect(first.status).toBe(200)
  expect(second.status).toBe(200)
  expect(await second.text()).toBe(firstBody)
  expect(firstBody).toContain('https://bandcamp.com/EmbeddedPlayer/album=123')
  expect(providerRequests).toHaveLength(60)
  expect(new Set(providerRequests).size).toBe(60)
  expect(requestScopes).toBe(2)
  expect(telemetry.map(({ requestId, route, status }) => ({ requestId, route, status }))).toEqual([
    { requestId: 'editorial-miss', route: '/api/content/posts/editorials', status: 200 },
    { requestId: 'editorial-hit', route: '/api/content/posts/editorials', status: 200 },
  ])
  expect(second.headers.get('access-control-allow-origin')).toBe(
    first.headers.get('access-control-allow-origin'),
  )
  expect(second.headers.get('vary')).toBe('Origin')
  expect(second.headers.get('cache-control')).toBe('public, max-age=60, stale-while-revalidate=300')
  expect(Number(second.headers.get('age'))).toBeGreaterThanOrEqual(0)

  for (const headers of [
    { cookie: 'session=private' },
    { authorization: 'Bearer private' },
    { 'cache-control': 'no-cache' },
  ]) {
    expect((await read(headers)).status).toBe(200)
  }

  expect(providerRequests).toHaveLength(240)
  expect(telemetry).toHaveLength(5)

  for (const [key, response] of stored) {
    const invalid = new Response('{"unexpected":true}', { headers: response.headers })

    stored.set(key, invalid)
  }

  const recovered = await read()
  expect(recovered.status).toBe(200)
  expect(await recovered.text()).toBe(firstBody)
  expect(providerRequests).toHaveLength(300)
  expect(telemetry).toHaveLength(6)
  console.info('Editorial cache evidence', {
    coldMs: durations[0],
    warmMs: durations[1],
    requestScopes,
    providerLookups: providerRequests.length,
  })
})
