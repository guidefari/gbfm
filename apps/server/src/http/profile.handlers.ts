import { Api } from '@gbfm/api/api'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { ProfileService } from '@/services/profile.service'

const dieOnDatabaseError = makeDieOnDatabaseError('profile')

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
