import { Effect, Fiber } from 'effect'

let currentIntent: Fiber.Fiber<void, unknown> | null = null

export const runNavigationIntent = (intent: Effect.Effect<void, unknown>) => {
  if (currentIntent) Effect.runFork(Fiber.interrupt(currentIntent))
  currentIntent = Effect.runFork(intent)
}
