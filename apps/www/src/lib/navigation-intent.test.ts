import { Effect } from 'effect'
import { expect, test } from 'vitest'
import { runNavigationIntent } from './navigation-intent'

test('superseding navigation aborts the stale workflow and completes its replacement', async () => {
  let requestStarted = false
  let requestAborted = false
  let staleNavigationRan = false
  let staleErrorPathRan = false
  let replacementCompleted = false

  runNavigationIntent(
    Effect.sync(() => (requestStarted = true)).pipe(
      Effect.andThen(
        Effect.onInterrupt(Effect.never, () => Effect.sync(() => (requestAborted = true)))
      ),
      Effect.andThen(Effect.sync(() => (staleNavigationRan = true))),
      Effect.tapError(() => Effect.sync(() => (staleErrorPathRan = true)))
    )
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  runNavigationIntent(Effect.sync(() => (replacementCompleted = true)))

  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(requestStarted).toBe(true)
  expect(requestAborted).toBe(true)
  expect(staleNavigationRan).toBe(false)
  expect(staleErrorPathRan).toBe(false)
  expect(replacementCompleted).toBe(true)
})

test('the newest of many rapid intents is the one that completes', async () => {
  const completed: Array<string> = []

  for (const destination of ['beta', 'gamma', 'delta', 'epsilon']) {
    runNavigationIntent(
      Effect.sleep('10 millis').pipe(Effect.andThen(Effect.sync(() => completed.push(destination))))
    )
  }

  await new Promise((resolve) => setTimeout(resolve, 50))

  expect(completed).toEqual(['epsilon'])
})

test('runs an uncontested intent to completion', () => {
  let completed = false

  runNavigationIntent(Effect.sync(() => (completed = true)))

  expect(completed).toBe(true)
})
