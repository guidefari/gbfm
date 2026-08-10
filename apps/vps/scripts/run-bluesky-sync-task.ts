import { Cause, Effect, Exit } from 'effect'
import { AppLayer } from '@/runtime/services'
import { BlueskySyncService } from '@/services/bluesky-sync.service'
import { NavigationRetentionService } from '@/services/navigation-retention.service'

const retentionSweep = Effect.gen(function* () {
  const navigationRetention = yield* NavigationRetentionService
  const navigationReport = yield* navigationRetention.sweepExpiredAnonymousSessions(new Date())
  yield* Effect.logInfo('Anonymous navigation session retention sweep finished', navigationReport)
}).pipe(
  Effect.tapCause((cause) =>
    Effect.logError('Anonymous navigation session retention sweep failed', { cause })
  )
)

const blueskySync = Effect.gen(function* () {
  const sync = yield* BlueskySyncService
  const syncReport = yield* sync.syncScheduled()
  yield* Effect.logInfo('Bluesky scheduled sync sweep finished', syncReport)
}).pipe(
  Effect.tapCause((cause) => Effect.logError('Bluesky scheduled sync sweep failed', { cause }))
)

const task = Effect.gen(function* () {
  const retentionExit = yield* Effect.exit(retentionSweep)
  const syncExit = yield* Effect.exit(blueskySync)

  if (Exit.isFailure(retentionExit) && Exit.isFailure(syncExit)) {
    return yield* Effect.failCause(Cause.combine(retentionExit.cause, syncExit.cause))
  }
  if (Exit.isFailure(retentionExit)) return yield* Effect.failCause(retentionExit.cause)
  if (Exit.isFailure(syncExit)) return yield* Effect.failCause(syncExit.cause)
})

// @ts-expect-error This script has no D1 binding outside the Worker request path; it is not yet ported off the Bun/Postgres runtime.
await Effect.runPromise(task.pipe(Effect.provide(AppLayer())))
