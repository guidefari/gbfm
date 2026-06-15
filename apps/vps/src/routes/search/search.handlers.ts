import { Effect } from 'effect'
import { runEffect } from '@/lib/effect-hono'
import type { AppRouteHandler } from '@/lib/types'
import { SearchService } from '@/services/search.service'

import type { SearchContentRoute } from './search.routes'

export const searchContent: AppRouteHandler<SearchContentRoute> = async (c) => {
  const { q, limit } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const searchService = yield* SearchService
    return yield* searchService.search(q, limit)
  }).pipe(Effect.withSpan('api.search.searchContent', { attributes: { q } }))

  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  return runEffect<SearchContentRoute>(c, program)
}
