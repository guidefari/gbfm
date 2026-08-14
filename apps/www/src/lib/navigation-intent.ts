import { Data, Effect, Fiber } from 'effect'

class NavigationIntentFailure extends Data.TaggedError('NavigationIntentFailure')<{
  readonly cause: unknown
}> {}

let currentIntent: Fiber.Fiber<void, NavigationIntentFailure> | null = null

export const runNavigationIntent = <E>(intent: Effect.Effect<void, E>) => {
  if (currentIntent) Effect.runFork(Fiber.interrupt(currentIntent))
  currentIntent = Effect.runFork(
    intent.pipe(Effect.mapError((cause) => new NavigationIntentFailure({ cause })))
  )
}
