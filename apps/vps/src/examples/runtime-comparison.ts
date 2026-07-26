/**
 * Performance comparison: Direct Effect.runPromise vs reused Context
 *
 * This demonstrates why reusing a built Context is more efficient for repeated executions
 */

import { Context, Effect, Exit, Layer, Scope } from 'effect'

// Simulated expensive service initialization
interface ExpensiveService {
  readonly doWork: () => Effect.Effect<string>
}

const ExpensiveService = Context.Service<ExpensiveService>('ExpensiveService')

let initCount = 0
let disposeCount = 0

const ExpensiveServiceLayer = Layer.effect(
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
  console.log('\n=== WITHOUT REUSED CONTEXT ===')
  const start = performance.now()

  // Run 10 times (like your cron job running 10 times)
  for (let i = 0; i < 10; i++) {
    await Effect.runPromise(myEffect.pipe(Effect.provide(ExpensiveServiceLayer)))
    // Service is created and destroyed EVERY TIME!
  }

  const duration = performance.now() - start
  console.log(`Time: ${duration.toFixed(2)}ms`)
  console.log(`Initializations: ${initCount}, Disposals: ${disposeCount}`)
}

// ==========================================
// APPROACH 2: Reused Context
// ==========================================
async function _approachWithRuntime() {
  console.log('\n=== WITH REUSED CONTEXT ===')
  initCount = 0
  disposeCount = 0

  const start = performance.now()

  // Build services ONCE
  const scope = Scope.makeUnsafe()
  const services = await Effect.runPromise(Layer.buildWithScope(ExpensiveServiceLayer, scope))

  // Run 10 times (like your cron job running 10 times)
  for (let i = 0; i < 10; i++) {
    await Effect.runPromiseWith(services)(myEffect)
    // Service is REUSED every time!
  }

  // Cleanup
  await Effect.runPromise(Scope.close(scope, Exit.void))

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
// Result: reused Context is ~10x faster and uses 1/10th the resources!
