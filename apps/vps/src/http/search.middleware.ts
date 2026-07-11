import { Effect } from 'effect'
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http'

// Global (not endpoint) middleware because HttpApiBuilder.group handlers only
// ever return the raw decoded success value -- there's no per-endpoint hook
// to attach response headers (effect@4.0.0-beta.93, verified against
// HttpApiBuilder.ts's response encoder). `{ global: true }` returns the Layer
// directly, unlike endpoint-scoped middleware which exposes it via `.layer`.
export const SearchCacheHeaderLive = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const response = yield* httpEffect
      const path = new URL(request.url, 'http://localhost').pathname
      if (path !== '/api/search') return response
      return HttpServerResponse.setHeader(
        response,
        'cache-control',
        'public, max-age=60, stale-while-revalidate=300'
      )
    }),
  { global: true }
)
