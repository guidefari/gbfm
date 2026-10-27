import { Clock, Context, Effect, Layer, Option } from 'effect'

export interface EditorialListQuery {
  readonly limit: number
  readonly offset: number
  readonly tag?: string
}

export interface EditorialListCache {
  readonly read: (query: EditorialListQuery) => Effect.Effect<Option.Option<CachedEditorialList>>
  readonly write: (query: EditorialListQuery, body: string) => Effect.Effect<void>
}

export const EditorialListCache = Context.Service<EditorialListCache>('EditorialListCache')

export interface CachedEditorialList {
  readonly body: string
  readonly ageSeconds: number
}

export const EditorialListCacheUnavailableLayer = Layer.succeed(EditorialListCache, {
  read: () => Effect.succeed(Option.none<CachedEditorialList>()),
  write: () => Effect.void,
})

export interface EditorialCacheStorage {
  readonly match: (key: string) => Promise<Response | undefined>
  readonly put: (key: string, response: Response) => Promise<void>
}

export const EditorialListCacheLayer = (
  storage: EditorialCacheStorage,
  namespace: { readonly origin: string; readonly release: string },
) => {
  const key = (query: EditorialListQuery) => {
    const url = new URL(
      `/__gbfm/editorials/${encodeURIComponent(namespace.release)}`,
      namespace.origin,
    )

    url.searchParams.set('limit', String(query.limit))
    url.searchParams.set('offset', String(query.offset))

    if (query.tag !== undefined) url.searchParams.set('tag', query.tag)

    return url.href
  }

  return Layer.succeed(EditorialListCache, {
    read: Effect.fn('editorialCache.read')(function* (query) {
      const now = yield* Clock.currentTimeMillis

      return yield* Effect.tryPromise(async () => {
        const response = await storage.match(key(query))

        if (!response) return Option.none<CachedEditorialList>()
        const createdAt = Date.parse(response.headers.get('date') ?? '')
        const ageSeconds = Math.floor((now - createdAt) / 1000)

        if (!Number.isFinite(ageSeconds) || ageSeconds < 0 || ageSeconds >= 60)
          return Option.none<CachedEditorialList>()

        return Option.some({ body: await response.text(), ageSeconds })
      }).pipe(
        Effect.catch(() =>
          Effect.logWarning('Editorial list cache unavailable', { operation: 'read' }).pipe(
            Effect.as(Option.none<CachedEditorialList>()),
          ),
        ),
      )
    }),
    write: Effect.fn('editorialCache.write')(function* (query, body) {
      const now = yield* Clock.currentTimeMillis
      yield* Effect.tryPromise(() =>
        storage.put(
          key(query),
          new Response(body, {
            headers: {
              'content-type': 'application/json',
              'cache-control': 'public, max-age=60',
              date: new Date(now).toUTCString(),
            },
          }),
        ),
      ).pipe(
        Effect.catch(() =>
          Effect.logWarning('Editorial list cache unavailable', { operation: 'write' }),
        ),
      )
    }),
  })
}
