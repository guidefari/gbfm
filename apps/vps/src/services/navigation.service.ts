import { Context, Effect, Layer } from 'effect'
import {
  type NavigationCommand,
  type NavigationIdentity,
  type NavigationResult,
  type Slug,
  CorpusExhausted,
  NoSuchMove
} from '@/domain/navigation'
import { type DatabaseError } from '@/errors'

export type IntentToken = string

export interface NavigationSessionService {
  readonly resolve: (
    identity: NavigationIdentity,
    command: NavigationCommand,
    from: Slug,
    intentToken: IntentToken
  ) => Effect.Effect<NavigationResult, NoSuchMove | CorpusExhausted | DatabaseError>
  readonly reset: (identity: NavigationIdentity) => Effect.Effect<void, DatabaseError>
}

export const NavigationSessionService = Context.Service<NavigationSessionService>(
  'NavigationSessionService'
)

export const NavigationSessionServiceLayer = Layer.effect(
  NavigationSessionService,
  Effect.succeed({
    resolve: () => Effect.die('NavigationSessionService.resolve is not implemented'),
    reset: () => Effect.die('NavigationSessionService.reset is not implemented')
  })
)
