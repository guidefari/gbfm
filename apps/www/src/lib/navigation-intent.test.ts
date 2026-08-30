import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { runNavigationIntent } from './navigation-intent'

describe('runNavigationIntent', () => {
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

  test('a superseded intent never reverts the url and never clears the busy flag', async () => {
    let url = 'alpha'
    let busy = false
    let latestIntentId = 0

    const runStep = (destination: string, failing: boolean) => {
      const intentId = latestIntentId + 1
      latestIntentId = intentId
      const isCurrent = () => latestIntentId === intentId
      busy = true
      url = destination

      runNavigationIntent(
        Effect.sleep('10 millis').pipe(
          Effect.andThen(
            failing ? Effect.fail('server down') : Effect.sync(() => (url = destination))
          ),
          Effect.tapError(() =>
            Effect.sync(() => {
              if (isCurrent()) url = 'alpha'
            })
          ),
          Effect.asVoid,
          Effect.ensuring(
            Effect.sync(() => {
              if (isCurrent()) busy = false
            })
          )
        )
      )
    }

    runStep('beta', true)
    runStep('gamma', false)

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(url).toBe('gamma')
    expect(busy).toBe(false)
    expect(latestIntentId).toBe(2)
  })

  test('the newest of many rapid intents is the one that completes', async () => {
    const completed: Array<string> = []

    for (const destination of ['beta', 'gamma', 'delta', 'epsilon']) {
      runNavigationIntent(
        Effect.sleep('10 millis').pipe(
          Effect.andThen(Effect.sync(() => completed.push(destination)))
        )
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
})

describe('peek with fire-and-forget visit', () => {
  test('a failed visit never reverts the url the peek settled on', async () => {
    let url = 'alpha'
    let visitFailed = false

    Effect.runFork(
      Effect.fail('visit rejected').pipe(
        Effect.tapError(() => Effect.sync(() => (visitFailed = true))),
        Effect.ignore
      )
    )

    runNavigationIntent(
      Effect.sync(() => (url = 'beta')).pipe(
        Effect.andThen(Effect.sleep('10 millis')),
        Effect.andThen(Effect.sync(() => (url = 'beta')))
      )
    )

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(visitFailed).toBe(true)
    expect(url).toBe('beta')
  })

  test('the url is reconciled when the settled destination differs from the peeked one', async () => {
    let url = 'alpha'
    const peeked = 'beta'

    runNavigationIntent(
      Effect.sync(() => (url = peeked)).pipe(
        Effect.andThen(Effect.sleep('10 millis')),
        Effect.andThen(Effect.succeed('gamma')),
        Effect.flatMap((destination) =>
          destination === peeked ? Effect.void : Effect.sync(() => (url = destination))
        )
      )
    )

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(url).toBe('gamma')
  })

  test('no reconciliation happens when the settled destination matches the peeked one', async () => {
    let url = 'alpha'
    let reconciled = false
    const peeked = 'beta'

    runNavigationIntent(
      Effect.sync(() => (url = peeked)).pipe(
        Effect.andThen(Effect.sleep('10 millis')),
        Effect.andThen(Effect.succeed(peeked)),
        Effect.flatMap((destination) =>
          destination === peeked
            ? Effect.void
            : Effect.sync(() => {
                reconciled = true
                url = destination
              })
        )
      )
    )

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(url).toBe('beta')
    expect(reconciled).toBe(false)
  })
})
