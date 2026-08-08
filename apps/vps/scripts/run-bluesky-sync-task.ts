import { Effect } from 'effect'
import { AppLayer } from '@/runtime/services'
import { BlueskySyncService } from '@/services/bluesky-sync.service'

const task = Effect.gen(function* () {
  const sync = yield* BlueskySyncService
  const report = yield* sync.syncScheduled()
  yield* Effect.logInfo('Bluesky scheduled sync sweep finished', report)
})

await Effect.runPromise(task.pipe(Effect.provide(AppLayer)))
