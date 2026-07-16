import { Api } from '@gbfm/api/api'
import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { SearchService } from '@/services/search.service'

const dieOnDatabaseError = makeDieOnDatabaseError('search')

export const SearchHandlersLive = HttpApiBuilder.group(Api, 'search', (handlers) =>
  handlers.handle('searchContent', ({ query }) =>
    Effect.gen(function* () {
      const svc = yield* SearchService
      return yield* dieOnDatabaseError(svc.search(query.q, query.limit))
    }).pipe(Effect.withSpan('api.search.searchContent', { attributes: { q: query.q } }))
  )
)
