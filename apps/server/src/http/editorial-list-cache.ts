import { GetEditorialPostsResponse } from '@gbfm/api/post'
import { Effect, Option, Schema } from 'effect'
import { HttpServerRequest } from 'effect/http'

import { EditorialListCache, type EditorialListQuery } from '@/services/editorial-list-cache'

type EditorialList = typeof GetEditorialPostsResponse.Type

export const cachedEditorialList = <E, R>(
  query: EditorialListQuery,
  render: Effect.Effect<EditorialList, E, R>,
) =>
  Effect.gen(function* () {
    const cache = yield* Effect.serviceOption(EditorialListCache)
    const request = yield* HttpServerRequest.HttpServerRequest
    const headers = request.headers

    const bypass =
      headers['authorization'] !== undefined ||
      headers['cookie'] !== undefined ||
      /\b(?:no-cache|no-store|max-age\s*=\s*0)\b/i.test(
        `${headers['cache-control'] ?? ''},${headers['pragma'] ?? ''}`,
      )

    if (Option.isNone(cache) || bypass) return { body: yield* render, ageSeconds: 0 }

    const cached = yield* cache.value.read(query)

    if (Option.isSome(cached)) {
      const decoded = yield* Schema.decodeUnknownEffect(
        Schema.fromJsonString(GetEditorialPostsResponse),
      )(cached.value.body).pipe(Effect.option)

      if (Option.isSome(decoded)) {
        yield* Effect.annotateCurrentSpan('gbfm.editorial_cache', 'hit')

        return { body: decoded.value, ageSeconds: cached.value.ageSeconds }
      }

      yield* Effect.logWarning('Editorial list cache entry rejected')
    }

    yield* Effect.annotateCurrentSpan('gbfm.editorial_cache', 'miss')
    const result = yield* render
    const encoded = yield* Schema.encodeEffect(GetEditorialPostsResponse)(result).pipe(Effect.orDie)
    yield* cache.value.write(query, JSON.stringify(encoded))

    return { body: result, ageSeconds: 0 }
  })
