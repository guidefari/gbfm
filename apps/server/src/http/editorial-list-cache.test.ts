import { GetEditorialPostsResponse } from '@gbfm/api/post'
import { Effect, Layer, Option, Schema } from 'effect'
import { HttpServerRequest } from 'effect/http'
import { expect, test } from 'vitest'

import { DatabaseError } from '@/errors'
import { EditorialListCache } from '@/services/editorial-list-cache'
import { withTestLayer } from '@/test/effect'

import { cachedEditorialList } from './editorial-list-cache'

const body = Schema.decodeUnknownSync(GetEditorialPostsResponse)({
  data: [],
  pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
})

const query = { limit: 20, offset: 0 }

test.each([
  { cookie: 'session=private' },
  { authorization: 'Bearer private' },
  { 'cache-control': 'no-cache' },
  { 'cache-control': 'no-store' },
  { 'cache-control': 'max-age=0' },
  { pragma: 'no-cache' },
])('does not read or write the public cache for %j', async (headers) => {
  let reads = 0
  let writes = 0
  let renders = 0

  const layer = Layer.mergeAll(
    Layer.succeed(
      HttpServerRequest.HttpServerRequest,
      HttpServerRequest.fromWeb(
        new Request('https://api.example.com/api/content/posts/editorials', { headers }),
      ),
    ),
    Layer.succeed(EditorialListCache, {
      read: () =>
        Effect.sync(() => {
          reads++

          return Option.some({ body: JSON.stringify(body), ageSeconds: 10 })
        }),
      write: () =>
        Effect.sync(() => {
          writes++
        }),
    }),
  )

  const result = await Effect.runPromise(
    withTestLayer(
      cachedEditorialList(
        query,
        Effect.sync(() => {
          renders++

          return body
        }),
      ),
      layer,
    ),
  )

  expect(result).toEqual({ body, ageSeconds: 0 })
  expect({ reads, writes, renders }).toEqual({ reads: 0, writes: 0, renders: 1 })
})

test('a failed render propagates without populating the cache', async () => {
  let writes = 0

  const layer = Layer.mergeAll(
    Layer.succeed(
      HttpServerRequest.HttpServerRequest,
      HttpServerRequest.fromWeb(
        new Request('https://api.example.com/api/content/posts/editorials'),
      ),
    ),
    Layer.succeed(EditorialListCache, {
      read: () => Effect.succeed(Option.none()),
      write: () =>
        Effect.sync(() => {
          writes++
        }),
    }),
  )

  await expect(
    Effect.runPromise(
      withTestLayer(
        cachedEditorialList(
          query,
          Effect.fail(
            new DatabaseError({ message: 'render failed', operation: 'select', table: 'posts' }),
          ),
        ),
        layer,
      ),
    ),
  ).rejects.toThrow('render failed')
  expect(writes).toBe(0)
})
