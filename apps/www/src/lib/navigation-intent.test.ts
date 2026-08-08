import { Effect, Exit, Fiber } from 'effect'
import { describe, expect, test } from 'vitest'
import { runNavigationIntent } from './navigation-intent'

describe('runNavigationIntent', () => {
  test('interrupts a prior intent before its trailing side effect runs', async () => {
    let firstCompleted = false
    let secondCompleted = false

    runNavigationIntent(
      Effect.never.pipe(Effect.andThen(Effect.sync(() => (firstCompleted = true))))
    )
    runNavigationIntent(Effect.sync(() => (secondCompleted = true)))

    await Promise.resolve()

    expect(firstCompleted).toBe(false)
    expect(secondCompleted).toBe(true)
  })

  test('aborts a superseded in-flight request without navigating', async () => {
    let requestStarted = false
    let requestAborted = false
    let navigated = false

    runNavigationIntent(
      Effect.sync(() => (requestStarted = true)).pipe(
        Effect.andThen(
          Effect.onInterrupt(Effect.never, () => Effect.sync(() => (requestAborted = true)))
        ),
        Effect.andThen(Effect.sync(() => (navigated = true)))
      )
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    runNavigationIntent(Effect.void)

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(requestStarted).toBe(true)
    expect(requestAborted).toBe(true)
    expect(navigated).toBe(false)
  })

  test('runs an uncontested intent to completion', () => {
    let completed = false

    runNavigationIntent(Effect.sync(() => (completed = true)))

    expect(completed).toBe(true)
  })

  test('does not run an interrupted intent error path', async () => {
    let errorPathRan = false
    let child: Fiber.Fiber<never> | undefined

    runNavigationIntent(
      Effect.forkChild(Effect.never).pipe(
        Effect.tap((fiber) => Effect.sync(() => (child = fiber))),
        Effect.andThen(Effect.never),
        Effect.tapError(() => Effect.sync(() => (errorPathRan = true)))
      )
    )
    runNavigationIntent(Effect.void)

    if (!child) throw new Error('Expected child fiber')

    const exit = await Effect.runPromise(Fiber.await(child))

    expect(Exit.hasInterrupts(exit)).toBe(true)
    expect(errorPathRan).toBe(false)
  })
})
