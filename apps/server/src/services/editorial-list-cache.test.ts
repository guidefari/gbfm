import { Effect, Layer, Option } from 'effect'
import { TestClock } from 'effect/testing'
import { expect, test } from 'vitest'

import { withTestLayer } from '@/test/effect'

import {
  EditorialListCache,
  EditorialListCacheLayer,
  type EditorialCacheStorage,
} from './editorial-list-cache'

const makeStorage = () => {
  const entries = new Map<string, Response>()

  const storage: EditorialCacheStorage = {
    match: async (key) => entries.get(key)?.clone(),
    put: async (key, response) => {
      entries.set(key, response.clone())
    },
  }

  return { entries, storage }
}

test('completed JSON survives fresh layers with bounded TTL and isolated query/release keys', async () => {
  const { entries, storage } = makeStorage()

  const layer = (release = 'one') =>
    EditorialListCacheLayer(storage, {
      origin: 'https://api.example.com',
      release,
    })

  const query = { limit: 20, offset: 0 }
  await Effect.runPromise(
    withTestLayer(
      Effect.flatMap(EditorialListCache, (cache) => cache.write(query, '{"data":[]}')),
      layer(),
    ),
  )

  const read = (options = query, release = 'one') =>
    Effect.runPromise(
      withTestLayer(
        Effect.flatMap(EditorialListCache, (cache) => cache.read(options)),
        layer(release),
      ),
    )

  expect(Option.getOrUndefined(await read())?.body).toBe('{"data":[]}')
  expect(await read({ limit: 10, offset: 0 })).toEqual(Option.none())
  expect(await read({ limit: 20, offset: 20 })).toEqual(Option.none())
  expect(await read(query, 'two')).toEqual(Option.none())
  const tagged = { ...query, tag: 'ambient' }
  expect(
    await Effect.runPromise(
      withTestLayer(
        Effect.flatMap(EditorialListCache, (cache) => cache.read(tagged)),
        layer(),
      ),
    ),
  ).toEqual(Option.none())
  expect(entries.size).toBe(1)

  for (const response of entries.values()) {
    expect(response.headers.get('cache-control')).toBe('public, max-age=60')
    expect([...response.headers.keys()].sort()).toEqual(['cache-control', 'content-type', 'date'])
  }
})

test('cache read and write failures do not fail requests', async () => {
  const storage: EditorialCacheStorage = {
    match: async () => {
      throw new Error('storage unavailable')
    },
    put: async () => {
      throw new Error('storage unavailable')
    },
  }

  const result = await Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        const cache = yield* EditorialListCache
        yield* cache.write({ limit: 20, offset: 0 }, '{}')

        return yield* cache.read({ limit: 20, offset: 0 })
      }),
      EditorialListCacheLayer(storage, { origin: 'https://api.example.com', release: 'one' }),
    ),
  )

  expect(result).toEqual(Option.none())
})

test('exposes cache age and refuses data at the 60-second expiry boundary', async () => {
  const { entries, storage } = makeStorage()

  const layer = Layer.mergeAll(
    TestClock.layer(),
    EditorialListCacheLayer(storage, {
      origin: 'https://api.example.com',
      release: 'one',
    }),
  )

  await Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        const cache = yield* EditorialListCache
        const query = { limit: 20, offset: 0 }
        yield* TestClock.setTime(1_000_000)
        yield* cache.write(query, '{}')
        yield* TestClock.setTime(1_059_000)
        expect(yield* cache.read(query)).toEqual(Option.some({ body: '{}', ageSeconds: 59 }))
        yield* TestClock.setTime(1_060_000)
        expect(yield* cache.read(query)).toEqual(Option.none())

        for (const response of entries.values()) response.headers.set('date', 'invalid')
        expect(yield* cache.read(query)).toEqual(Option.none())
      }),
      layer,
    ),
  )
})
