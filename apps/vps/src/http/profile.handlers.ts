import { Api } from '@gbfm/api/api'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { ProfileService } from '@/services/profile.service'

// Undeclared DatabaseError becomes a logged defect (500), same as the old
// runEffect's fallback for anything that wasn't a mapped HttpError.
const dieOnDatabaseError = <A, E, R>(effect: Effect.Effect<A, E | DatabaseErrorTag, R>) =>
  effect.pipe(
    Effect.tapErrorTag('DatabaseError', (cause) =>
      Effect.logError('[profile] database operation failed', cause)
    ),
    Effect.catchTag('DatabaseError', (cause) => Effect.die(cause))
  )

type DatabaseErrorTag = { readonly _tag: 'DatabaseError' }

export const ProfileHandlersLive = HttpApiBuilder.group(Api, 'profile', (handlers) =>
  handlers.handle('getPublicProfile', ({ params }) =>
    Effect.gen(function* () {
      const svc = yield* ProfileService
      const profile = yield* dieOnDatabaseError(
        svc
          .getPublicProfile(params.username)
          .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
      )
      return {
        ...profile,
        createdAt: profile.createdAt.toISOString(),
        content: {
          ...profile.content,
          editorials: profile.content.editorials.map((editorial) => ({
            ...editorial,
            createdAt: editorial.createdAt.toISOString()
          })),
          tweets: profile.content.tweets.map((tweet) => ({
            ...tweet,
            createdAt: tweet.createdAt.toISOString()
          }))
        }
      }
    })
  )
)
