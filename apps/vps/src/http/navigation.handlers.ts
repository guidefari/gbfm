import { Api } from '@gbfm/api/api'
import type { NavigationCommand as ApiNavigationCommand } from '@gbfm/api/navigation'
import { Effect, Schema } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { type NavigationCommand, Slug } from '@/domain/navigation'
import { IdentityResolver } from '@/middleware/optional-auth.impl'
import { NavigationSessionService } from '@/services/navigation.service'

const decodeSlug = Schema.decodeUnknownSync(Slug)

const toNavigationCommand = (command: ApiNavigationCommand): NavigationCommand => {
  switch (command._tag) {
    case 'Step':
      return command
    case 'Jump':
      return command
    case 'Open':
      return { ...command, slug: decodeSlug(command.slug) }
  }
}

export const NavigationHandlersLive = HttpApiBuilder.group(Api, 'navigation', (handlers) =>
  handlers.handle('navigateMicroPosts', ({ payload }) =>
    Effect.gen(function* () {
      const { resolve: resolveIdentity } = yield* IdentityResolver
      const navigation = yield* NavigationSessionService
      const identity = yield* resolveIdentity
      const result = yield* navigation
        .resolve(
          identity,
          toNavigationCommand(payload.command),
          decodeSlug(payload.from),
          payload.intentToken
        )
        .pipe(
          Effect.catchTag('NoSuchMove', () => new HttpApiError.Conflict()),
          Effect.catchTag('CorpusExhausted', () => new HttpApiError.Conflict()),
          Effect.catchTag('DatabaseError', () => new HttpApiError.InternalServerError())
        )

      return result
    })
  )
)
