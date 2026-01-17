import { type Effect, ManagedRuntime } from 'effect'
import { AppLayer } from './services'

/**
 * Main application runtime
 *
 * This creates a long-lived runtime that:
 * - Initializes all services once at startup
 * - Keeps service instances alive and ready for reuse
 * - Automatically injects services into all effects
 * - Handles cleanup on shutdown
 *
 * Benefits over direct Effect.runPromise:
 * - 60x fewer service initializations (for cron jobs running every minute)
 * - Reuses database connection pools
 * - Better performance and lower memory usage
 * - Centralized service configuration
 */
export const AppRuntime = ManagedRuntime.make(AppLayer)

/**
 * Run an effect with the application runtime
 *
 * Use this for most application logic (cron jobs, HTTP handlers, etc.)
 *
 * @example
 * ```typescript
 * await runApp(processPendingReminders)
 * ```
 */
export const runApp = <A, E>(effect: Effect.Effect<A, E>) =>
  AppRuntime.runPromise(effect)

/**
 * Run an effect synchronously (blocking)
 *
 * Use sparingly - only for initialization code that must complete before continuing
 *
 * @example
 * ```typescript
 * const config = runAppSync(loadConfig)
 * ```
 */
export const runAppSync = <A, E>(effect: Effect.Effect<A, E>) =>
  AppRuntime.runSync(effect)

/**
 * Fork an effect to run in the background
 *
 * Use for fire-and-forget operations
 *
 * @example
 * ```typescript
 * const fiber = runAppFork(sendAnalyticsEvent)
 * // ... later if needed ...
 * await fiber.await()
 * ```
 */
export const runAppFork = <A, E>(effect: Effect.Effect<A, E>) =>
  AppRuntime.runFork(effect)

/**
 * Dispose of the runtime and clean up all resources
 *
 * Call this on application shutdown to:
 * - Close database connections
 * - Flush pending operations
 * - Clean up any resources held by services
 *
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   await disposeRuntime()
 *   process.exit(0)
 * })
 * ```
 */
export const disposeRuntime = () => AppRuntime.dispose()
