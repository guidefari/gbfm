import { Api } from '@gbfm/api/api'
import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import { SearchService } from '@/services/search.service'

// Undeclared DatabaseError becomes a logged defect (500), same fallback as
// the old runEffect for anything that wasn't a mapped HttpError.
const dieOnDatabaseError = <A, E, R>(effect: Effect.Effect<A, E | DatabaseErrorTag, R>) =>
  effect.pipe(
    Effect.tapErrorTag('DatabaseError', (cause) =>
      Effect.logError('[search] database operation failed', cause)
    ),
    Effect.catchTag('DatabaseError', (cause) => Effect.die(cause))
  )

type DatabaseErrorTag = { readonly _tag: 'DatabaseError' }

export const SearchHandlersLive = HttpApiBuilder.group(Api, 'search', (handlers) =>
  handlers.handle('searchContent', ({ query }) =>
    Effect.gen(function* () {
      const svc = yield* SearchService
      return yield* dieOnDatabaseError(svc.search(query.q, query.limit))
    }).pipe(Effect.withSpan('api.search.searchContent', { attributes: { q: query.q } }))
  )
)
