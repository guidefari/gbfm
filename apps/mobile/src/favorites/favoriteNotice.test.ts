import { Effect, Fiber, ManagedRuntime } from 'effect'
import { TestClock } from 'effect/testing'
import { expect, test } from 'vitest'

import { dismissFavoriteNoticeAfterDelay } from './favoriteNotice'
import { FavoriteEvent } from './favoriteState'

test('expires at four seconds and lets its owner cancel on replacement or unmount', async () => {
  const runtime = ManagedRuntime.make(TestClock.layer())

  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const delivered: Array<FavoriteEvent> = []

        const start = (id: number) =>
          dismissFavoriteNoticeAfterDelay('listener-track', { id, message: 'Try again.' }).pipe(
            Effect.tap((event) => Effect.sync(() => delivered.push(event))),
            Effect.forkChild,
          )

        const first = yield* start(1)
        yield* TestClock.adjust('3 seconds')
        expect(delivered).toEqual([])
        yield* Fiber.interrupt(first)
        const second = yield* start(2)
        yield* TestClock.adjust('3 seconds')
        expect(delivered).toEqual([])
        yield* TestClock.adjust('1 second')
        yield* Fiber.join(second)
        expect(delivered).toEqual([FavoriteEvent.NoticeDismissed({ key: 'listener-track', id: 2 })])
        const unmounted = yield* start(3)
        yield* Fiber.interrupt(unmounted)
        yield* TestClock.adjust('4 seconds')
        expect(delivered).toHaveLength(1)
      }),
    )
  } finally {
    await runtime.dispose()
  }
})
