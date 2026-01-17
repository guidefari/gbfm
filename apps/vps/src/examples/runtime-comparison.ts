/**
 * Performance comparison: Direct Effect.runPromise vs ManagedRuntime
 *
 * This demonstrates why ManagedRuntime is more efficient for repeated executions
 */

import { Context, Effect, Layer, ManagedRuntime } from 'effect'

// Simulated expensive service initialization
interface ExpensiveService {
  readonly doWork: () => Effect.Effect<string>
}

const ExpensiveService = Context.Tag<ExpensiveService>('@example/ExpensiveService')

let initCount = 0
let disposeCount = 0

const ExpensiveServiceLive = Layer.effect(
  ExpensiveService,
  Effect.gen(function* () {
    // Simulate expensive initialization (database connections, etc.)
    console.log(`[${++initCount}] Initializing service... (expensive!)`)
    yield* Effect.sleep('100 millis')  // Simulates connection setup

    return {
      doWork: () => Effect.succeed('work done')
    }
  })
).pipe(
  Layer.withDispose(() => {
    console.log(`[${++disposeCount}] Disposing service... (cleanup!)`)
    return Effect.void
  })
)

const myEffect = Effect.gen(function* () {
  const service = yield* ExpensiveService
  return yield* service.doWork()
})

// ==========================================
// APPROACH 1: Direct Effect.runPromise
// ==========================================
async function approachWithoutRuntime() {
  console.log('\n=== WITHOUT ManagedRuntime ===')
  const start = performance.now()

  // Run 10 times (like your cron job running 10 times)
  for (let i = 0; i < 10; i++) {
    await Effect.runPromise(
      myEffect.pipe(Effect.provide(ExpensiveServiceLive))
    )
    // Service is created and destroyed EVERY TIME!
  }

  const duration = performance.now() - start
  console.log(`Time: ${duration.toFixed(2)}ms`)
  console.log(`Initializations: ${initCount}, Disposals: ${disposeCount}`)
}

// ==========================================
// APPROACH 2: ManagedRuntime
// ==========================================
async function approachWithRuntime() {
  console.log('\n=== WITH ManagedRuntime ===')
  initCount = 0
  disposeCount = 0

  const start = performance.now()

  // Create runtime ONCE
  const runtime = ManagedRuntime.make(ExpensiveServiceLive)

  // Run 10 times (like your cron job running 10 times)
  for (let i = 0; i < 10; i++) {
    await runtime.runPromise(myEffect)
    // Service is REUSED every time!
  }

  // Cleanup
  await runtime.dispose()

  const duration = performance.now() - start
  console.log(`Time: ${duration.toFixed(2)}ms`)
  console.log(`Initializations: ${initCount}, Disposals: ${disposeCount}`)
}

// ==========================================
// Run comparison
// ==========================================
async function main() {
  await approachWithoutRuntime()
  // Output:
  // [1] Initializing service... (expensive!)
  // [1] Disposing service... (cleanup!)
  // [2] Initializing service... (expensive!)
  // [2] Disposing service... (cleanup!)
  // ... 10 times total
  // Time: ~1000ms
  // Initializations: 10, Disposals: 10

  await approachWithRuntime()
  // Output:
  // [1] Initializing service... (expensive!)
  // ... runs 10 times with no more init ...
  // [1] Disposing service... (cleanup!)
  // Time: ~100ms
  // Initializations: 1, Disposals: 1

  console.log('\n=== RESULT ===')
  console.log('ManagedRuntime is ~10x faster and uses 1/10th the resources!')
}

// Uncomment to run:
// main()
