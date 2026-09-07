import { Context, Effect, Layer } from 'effect'
import {
  type NavigationCommand,
  type NavigationIdentity,
  type NavigationResult,
  type CorpusExhausted,
  type Slug,
  NoSuchMove
} from '@/domain/navigation'
import type { DatabaseError } from '@/errors'
import { makeNavigationPersistence } from './navigation-persistence'

export type IntentToken = string

export type NavigationSessionRead = {
  readonly slug: Slug | null
  readonly capabilities: NavigationResult['capabilities']
}

export type NavigationVisitOutcome = { readonly recorded: boolean }

export interface NavigationSessionService {
  readonly peek: (
    identity: NavigationIdentity,
    command: NavigationCommand,
    from: Slug
  ) => Effect.Effect<NavigationResult, NoSuchMove | CorpusExhausted | DatabaseError>
  readonly record: (
    identity: NavigationIdentity,
    command: NavigationCommand,
    from: Slug,
    intentToken: IntentToken
  ) => Effect.Effect<NavigationVisitOutcome, NoSuchMove | CorpusExhausted | DatabaseError>
  readonly resolve: (
    identity: NavigationIdentity,
    command: NavigationCommand,
    from: Slug,
    intentToken: IntentToken
  ) => Effect.Effect<NavigationResult, NoSuchMove | CorpusExhausted | DatabaseError>
  readonly read: (
    identity: NavigationIdentity
  ) => Effect.Effect<NavigationSessionRead, DatabaseError>
  readonly reset: (identity: NavigationIdentity) => Effect.Effect<void, DatabaseError>
}

export const NavigationSessionService = Context.Service<NavigationSessionService>(
  'NavigationSessionService'
)

const MAX_NAVIGATION_LOCK_RETRIES = 5

export const NavigationSessionServiceLayer = Layer.effect(
  NavigationSessionService,
  Effect.gen(function* () {
    const persistence = yield* makeNavigationPersistence

    const resolve = (
      identity: NavigationIdentity,
      command: NavigationCommand,
      from: Slug,
      intentToken: IntentToken
    ) =>
      Effect.gen(function* () {
        for (let retryCount = 0; ; retryCount += 1) {
          yield* Effect.annotateCurrentSpan('retried', retryCount > 0)
          const outcome = yield* persistence.attempt(identity, command, from, intentToken)
          if (!('_tag' in outcome)) return outcome
          if (retryCount === MAX_NAVIGATION_LOCK_RETRIES) {
            return yield* new NoSuchMove({
              command: command._tag === 'Step' ? `Step(${command.direction})` : command._tag
            })
          }
          yield* Effect.sleep('1 millis')
        }
      })

    return {
      peek: (identity, command, from) =>
        persistence
          .preview(identity, command, from)
          .pipe(Effect.tapError((error) => Effect.annotateCurrentSpan('errorType', error._tag))),
      record: (identity, command, from, intentToken) =>
        resolve(identity, command, from, intentToken).pipe(
          Effect.map(() => ({ recorded: true })),
          Effect.withSpan('navigation.record', {
            attributes:
              command._tag === 'Step'
                ? { command: command._tag, direction: command.direction }
                : { command: command._tag }
          })
        ),
      resolve: (identity, command, from, intentToken) =>
        resolve(identity, command, from, intentToken).pipe(
          Effect.tapError((error) => Effect.annotateCurrentSpan('errorType', error._tag)),
          Effect.withSpan('navigation.resolve', {
            attributes:
              command._tag === 'Step'
                ? {
                    command: command._tag,
                    direction: command.direction,
                    identityKind: identity._tag
                  }
                : { command: command._tag, identityKind: identity._tag }
          })
        ),
      read: persistence.read,
      reset: persistence.reset
    }
  })
)
