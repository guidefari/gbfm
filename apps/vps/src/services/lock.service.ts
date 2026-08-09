import { Context, Effect, Layer } from 'effect'
import { DatabaseError, LockUnavailable } from '@/errors'

export interface LockService {
  readonly withLock: <A, E, R>(
    key: string,
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | LockUnavailable | DatabaseError, R>
}

export const LockService = Context.Service<LockService>('LockService')

const withLock = <A, E, R>(
  key: string,
  _effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | LockUnavailable | DatabaseError, R> => new LockUnavailable({ key })

export const LockServiceLayer = Layer.succeed(LockService, {
  withLock
})
