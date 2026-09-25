import { Context, Data, Effect, Layer, Predicate } from 'effect'

import type { NavigationIdentity } from '@/domain/navigation'
import type { DatabaseError } from '@/errors'

export type LockRequest = {
  readonly sessionId: string | null
  readonly cursor: number | null
  readonly updatedAtMs: number | null
  readonly intentToken: string
}

export type LockDecision =
  | { readonly _tag: 'Duplicate'; readonly sessionId: string }
  | { readonly _tag: 'Retry' }
  | { readonly _tag: 'Proceed'; readonly sessionId: string | null; readonly position: number }

export const LockDecision = Data.taggedEnum<LockDecision>()

export type LockCommit = {
  readonly sessionId: string
  readonly position: number
  readonly intentToken: string
  readonly updatedAtMs: number
}

export const canonicalNavigationLockName = (identity: NavigationIdentity): string =>
  Predicate.isTagged(identity, 'User')
    ? `user:${identity.userId}`
    : `device:${identity.deviceToken}`

export interface NavigationLockContract {
  readonly decide: (
    identity: NavigationIdentity,
    request: LockRequest,
  ) => Effect.Effect<LockDecision, DatabaseError>
  readonly commit: (
    identity: NavigationIdentity,
    input: LockCommit,
  ) => Effect.Effect<void, DatabaseError>
  readonly sync: (
    identity: NavigationIdentity,
    input: LockCommit,
  ) => Effect.Effect<void, DatabaseError>
  readonly reset: (identity: NavigationIdentity) => Effect.Effect<void, DatabaseError>
}

export class NavigationLock extends Context.Service<NavigationLock, NavigationLockContract>()(
  'NavigationLock',
) {}

type LocalSession = {
  readonly sessionId: string | null
  readonly cursor: number
  readonly updatedAtMs: number | null
  readonly lastIntentToken: string | null
}

type LocalState = {
  session: LocalSession | null
}

export const NavigationLockLocalLayer = Layer.sync(NavigationLock, () => {
  const sessions = new Map<string, LocalState>()

  const stateFor = (name: string): LocalState => {
    const existing = sessions.get(name)

    if (existing) return existing
    const created: LocalState = { session: null }
    sessions.set(name, created)

    return created
  }

  const decide = (identity: NavigationIdentity, request: LockRequest) =>
    Effect.sync((): LockDecision => {
      const state = stateFor(canonicalNavigationLockName(identity))
      const local = state.session

      if (local?.lastIntentToken === request.intentToken && local.sessionId) {
        return LockDecision.Duplicate({ sessionId: local.sessionId })
      }

      if (local && (local.cursor !== request.cursor || local.updatedAtMs !== request.updatedAtMs)) {
        return LockDecision.Retry()
      }

      const position = (local?.cursor ?? request.cursor ?? -1) + 1
      const sessionId = local?.sessionId ?? request.sessionId
      state.session = {
        sessionId,
        cursor: position,
        updatedAtMs: request.updatedAtMs,
        lastIntentToken: null,
      }

      return LockDecision.Proceed({ sessionId, position })
    })

  const commit = (identity: NavigationIdentity, input: LockCommit) =>
    Effect.sync(() => {
      const state = stateFor(canonicalNavigationLockName(identity))
      state.session = {
        sessionId: input.sessionId,
        cursor: input.position,
        updatedAtMs: input.updatedAtMs,
        lastIntentToken: input.intentToken,
      }
    })

  const reset = (identity: NavigationIdentity) =>
    Effect.sync(() => {
      sessions.delete(canonicalNavigationLockName(identity))
    })

  return { decide, commit, sync: commit, reset }
})
