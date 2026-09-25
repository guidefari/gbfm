import { Api } from '@gbfm/api/api'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'

import { IdentityResolver } from '@/middleware/optional-auth.impl'
import { NavigationService } from '@/services/navigation.service'

const withIdentity = Effect.gen(function* () {
  const { resolve } = yield* IdentityResolver
  const navigation = yield* NavigationService
  const identity = yield* resolve

  return { identity, navigation }
})

export const NavigationHandlersLive = HttpApiBuilder.group(Api, 'navigation', (handlers) =>
  handlers
    .handle('getMicroPostNeighbours', ({ params }) =>
      Effect.gen(function* () {
        const { identity, navigation } = yield* withIdentity

        return yield* navigation.neighbours(identity, params.slug)
      }).pipe(
        Effect.catchTag('MicroPostMissing', () => new HttpApiError.NotFound()),
        Effect.catchTag('DatabaseError', () => new HttpApiError.InternalServerError()),
      ),
    )
    .handle('getRandomUnreadMicroPost', ({ params }) =>
      Effect.gen(function* () {
        const { identity, navigation } = yield* withIdentity
        const slug = yield* navigation.randomUnread(identity, params.slug)

        return { slug }
      }).pipe(
        Effect.catchTag('CorpusExhausted', () => new HttpApiError.NotFound()),
        Effect.catchTag('DatabaseError', () => new HttpApiError.InternalServerError()),
      ),
    )
    .handle('markMicroPostSeen', ({ params }) =>
      Effect.gen(function* () {
        const { identity, navigation } = yield* withIdentity
        yield* navigation.markSeen(identity, params.slug)

        return { recorded: true }
      }).pipe(
        Effect.catchTag('MicroPostMissing', () => new HttpApiError.NotFound()),
        Effect.catchTag('DatabaseError', () => new HttpApiError.InternalServerError()),
      ),
    ),
)
