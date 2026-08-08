import { Effect } from 'effect'
import { AppLayer } from '@/runtime/services'
import { BlueskySyncService } from '@/services/bluesky-sync.service'
import { NavigationRetentionService } from '@/services/navigation-retention.service'

const task = Effect.gen(function* () {
  const navigationRetention = yield* NavigationRetentionService
  const navigationReport = yield* navigationRetention.sweepExpiredAnonymousSessions(new Date())
  yield* Effect.logInfo('Anonymous navigation session retention sweep finished', navigationReport)

  const sync = yield* BlueskySyncService
  const syncReport = yield* sync.syncScheduled()
  yield* Effect.logInfo('Bluesky scheduled sync sweep finished', syncReport)
})

await Effect.runPromise(task.pipe(Effect.provide(AppLayer)))
