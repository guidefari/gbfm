import { Api } from '@gbfm/api/api'
import type { NavigationCommand as ApiNavigationCommand } from '@gbfm/api/navigation'
import { Effect, Match, Predicate, Schema } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'

import { type NavigationCommand, Slug } from '@/domain/navigation'
import { IdentityResolver } from '@/middleware/optional-auth.impl'
import { NavigationSessionService } from '@/services/navigation.service'

const decodeSlug = Schema.decodeUnknownSync(Slug)

const toNavigationCommand = (command: ApiNavigationCommand): NavigationCommand => {
  return Match.value(command).pipe(
    Match.tag('Step', (command) => command),
    Match.tag('Jump', (command) => command),
    Match.tag('Open', (command) => ({ ...command, slug: decodeSlug(command.slug) })),
    Match.exhaustive,
  )
}

export const NavigationHandlersLive = HttpApiBuilder.group(Api, 'navigation', (handlers) =>
  handlers
    .handle('getMicroPostNavigationSession', () =>
      Effect.gen(function* () {
        const { resolve: resolveIdentity } = yield* IdentityResolver
        const navigation = yield* NavigationSessionService
        const identity = yield* resolveIdentity

        return yield* navigation
          .read(identity)
          .pipe(Effect.catchTag('DatabaseError', () => new HttpApiError.InternalServerError()))
      }),
    )
    .handle('peekMicroPostNavigation', ({ payload }) => {
      const command = toNavigationCommand(payload.command)

      return Effect.gen(function* () {
        const { resolve: resolveIdentity } = yield* IdentityResolver
        const navigation = yield* NavigationSessionService
        const identity = yield* resolveIdentity

        return yield* navigation.peek(identity, command, decodeSlug(payload.from)).pipe(
          Effect.catchTag('NoSuchMove', () => new HttpApiError.Conflict()),
          Effect.catchTag('CorpusExhausted', () =>
            Effect.fail<HttpApiError.NotFound | HttpApiError.Conflict>(
              Predicate.isTagged(command, 'Open')
                ? new HttpApiError.NotFound()
                : new HttpApiError.Conflict(),
            ),
          ),
          Effect.catchTag('DatabaseError', () => new HttpApiError.InternalServerError()),
        )
      }).pipe(
        Effect.withSpan('navigation.peek.request', {
          attributes: Predicate.isTagged(command, 'Step')
            ? { command: command._tag, direction: command.direction }
            : { command: command._tag },
        }),
      )
    })
    .handle('recordMicroPostVisit', ({ payload }) => {
      const command = toNavigationCommand(payload.command)

      return Effect.gen(function* () {
        const { resolve: resolveIdentity } = yield* IdentityResolver
        const navigation = yield* NavigationSessionService
        const identity = yield* resolveIdentity

        return yield* navigation
          .record(identity, command, decodeSlug(payload.from), payload.intentToken)
          .pipe(
            Effect.catchTag('NoSuchMove', () => Effect.succeed({ recorded: false })),
            Effect.catchTag('CorpusExhausted', () => Effect.succeed({ recorded: false })),
            Effect.catchTag('DatabaseError', () => new HttpApiError.InternalServerError()),
          )
      }).pipe(
        Effect.withSpan('navigation.visit.request', {
          attributes: Predicate.isTagged(command, 'Step')
            ? { command: command._tag, direction: command.direction }
            : { command: command._tag },
        }),
      )
    })
    .handle('navigateMicroPosts', ({ payload }) => {
      const command = toNavigationCommand(payload.command)

      return Effect.gen(function* () {
        const { resolve: resolveIdentity } = yield* IdentityResolver
        const navigation = yield* NavigationSessionService
        const identity = yield* resolveIdentity.pipe(Effect.withSpan('navigation.identity.resolve'))
        yield* Effect.annotateCurrentSpan('identityKind', identity._tag)

        const result = yield* navigation
          .resolve(identity, command, decodeSlug(payload.from), payload.intentToken)
          .pipe(
            Effect.catchTag('NoSuchMove', () => new HttpApiError.Conflict()),
            Effect.catchTag('CorpusExhausted', () =>
              Effect.fail<HttpApiError.NotFound | HttpApiError.Conflict>(
                Predicate.isTagged(command, 'Open')
                  ? new HttpApiError.NotFound()
                  : new HttpApiError.Conflict(),
              ),
            ),
            Effect.catchTag('DatabaseError', () => new HttpApiError.InternalServerError()),
          )

        return result
      }).pipe(
        Effect.withSpan('navigation.request', {
          attributes: Predicate.isTagged(command, 'Step')
            ? { command: command._tag, direction: command.direction }
            : { command: command._tag },
        }),
      )
    }),
)
