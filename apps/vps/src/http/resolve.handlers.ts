import { Api } from '@gbfm/api/api'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { ResolveService } from '@/services/resolve.service'

const dieOnDatabaseError = makeDieOnDatabaseError('resolve')

export const ResolveHandlersLive = HttpApiBuilder.group(Api, 'resolve', (handlers) =>
  handlers.handle('resolveSlug', ({ params }) =>
    Effect.gen(function* () {
      const svc = yield* ResolveService
      const result = yield* dieOnDatabaseError(
        svc
          .resolve(params.slug)
          .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
      )

      if (result.type === 'show') {
        return {
          ...result,
          data: { ...result.data, createdAt: result.data.createdAt.toISOString() }
        }
      }

      const profile = result.data
      return {
        type: 'profile' as const,
        data: {
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
      }
    })
  )
)
