import { Effect, Option } from 'effect'

import { EditorialListCache, EditorialListCacheLayer } from '../services/editorial-list-cache'
import { withTestLayer } from './effect'

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const query = { limit: Number(url.searchParams.get('limit') ?? 20), offset: 0 }
    const body = request.method === 'PUT' ? await request.text() : null

    const operation = Effect.gen(function* () {
      const cache = yield* EditorialListCache

      if (body !== null) {
        yield* cache.write(query, body)

        return new Response(null, { status: 204 })
      }

      const cached = yield* cache.read(query)

      return Option.isSome(cached)
        ? new Response(cached.value.body, { headers: { 'content-type': 'application/json' } })
        : new Response(null, { status: 404 })
    })

    return Effect.runPromise(
      withTestLayer(
        operation,
        EditorialListCacheLayer(caches.default, {
          origin: url.origin,
          release: request.headers.get('x-test-release') ?? 'one',
        }),
      ),
    )
  },
}
