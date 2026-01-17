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

const ExpensiveService =
  Context.GenericTag<ExpensiveService>('ExpensiveService')

let initCount = 0
let disposeCount = 0

const ExpensiveServiceLive = Layer.effect(
  ExpensiveService,
  Effect.gen(function* () {
    // Simulate expensive initialization (database connections, etc.)
    console.log(`[${++initCount}] Initializing service... (expensive!)`)
    yield* Effect.sleep('100 millis') // Simulates connection setup

    return {
      doWork: () => Effect.succeed('work done')
    }
  })
)

const myEffect = Effect.gen(function* () {
  const service = yield* ExpensiveService
  return yield* service.doWork()
})

// ==========================================
// APPROACH 1: Direct Effect.runPromise
// ==========================================
async function _approachWithoutRuntime() {
  console.log('\n=== WITHOUT ManagedRuntime ===')
  const start = performance.now()

  // Run 10 times (like your cron job running 10 times)
  for (let i = 0; i < 10; i++) {
    await Effect.runPromise(myEffect.pipe(Effect.provide(ExpensiveServiceLive)))
    // Service is created and destroyed EVERY TIME!
  }

  const duration = performance.now() - start
  console.log(`Time: ${duration.toFixed(2)}ms`)
  console.log(`Initializations: ${initCount}, Disposals: ${disposeCount}`)
}

// ==========================================
// APPROACH 2: ManagedRuntime
// ==========================================
async function _approachWithRuntime() {
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
// Example Usage
// ==========================================
//
// To run the comparison yourself:
//
// await _approachWithoutRuntime()
// // Expected output: 10 initializations, ~1000ms
//
// await _approachWithRuntime()
// // Expected output: 1 initialization, ~100ms
//
// Result: ManagedRuntime is ~10x faster and uses 1/10th the resources!
