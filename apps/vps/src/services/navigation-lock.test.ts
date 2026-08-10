import { Effect, ManagedRuntime } from 'effect'
import { afterAll, describe, expect, test } from 'vitest'
import {
  NavigationLock,
  NavigationLockLocalLayer,
  type LockDecision,
  type LockRequest
} from './navigation-lock'

const runtime = ManagedRuntime.make(NavigationLockLocalLayer)
const identity = { _tag: 'Anonymous' as const, deviceToken: 'concurrent-reader' }
const sessionId = 'session-1'
const cursor = 0
const updatedAtMs = 1
const request = {
  sessionId,
  cursor,
  updatedAtMs,
  intentToken: 'intent-1'
} satisfies LockRequest

const decideConcurrently = Effect.gen(function* () {
  const lock = yield* NavigationLock
  yield* lock.commit(identity, {
    sessionId,
    position: cursor,
    intentToken: 'seed',
    updatedAtMs
  })
  return yield* Effect.all([lock.decide(identity, request), lock.decide(identity, request)], {
    concurrency: 'unbounded'
  })
})

afterAll(() => runtime.dispose())

describe('NavigationLockLocalLayer', () => {
  test('serializes concurrent requests so only one reserves the cursor position', async () => {
    const decisions = await runtime.runPromise(decideConcurrently)
    const proceeds = decisions.filter(
      (decision): decision is Extract<LockDecision, { readonly _tag: 'Proceed' }> =>
        decision._tag === 'Proceed'
    )

    expect(proceeds).toEqual([{ _tag: 'Proceed', sessionId, position: 1 }])
    expect(decisions.filter((decision) => decision._tag === 'Retry')).toHaveLength(1)
  })
})
