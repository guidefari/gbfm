import { Api } from '@gbfm/api/api'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/http-api'

import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { ResolveService } from '@/services/resolve.service'

import { resolvePageSession } from './page-session'

const dieOnDatabaseError = makeDieOnDatabaseError('resolve')

export const ResolveHandlersLive = HttpApiBuilder.group(Api, 'resolve', (handlers) =>
  handlers.handle('resolveSlug', ({ params }) =>
    Effect.gen(function* () {
      const svc = yield* ResolveService
      const principal = yield* resolvePageSession()
      const viewer = principal ? { userId: principal.id, userRole: principal.role } : undefined

      const result = yield* dieOnDatabaseError(
        svc
          .resolve(params.slug, viewer)
          .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound())),
      )

      if (result.type === 'show') {
        return {
          ...result,
          data: { ...result.data, createdAt: result.data.createdAt.toISOString() },
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
              createdAt: editorial.createdAt.toISOString(),
            })),
            tweets: profile.content.tweets.map((tweet) => ({
              ...tweet,
              createdAt: tweet.createdAt.toISOString(),
            })),
          },
        },
      }
    }),
  ),
)
