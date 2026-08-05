import { and, eq, lte, or, isNull } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '@/db'
import { blueskySyncStates, externalAccounts } from '@/db/external-account.schema'
import { AppLayer } from '@/runtime/services'
import { BlueskySyncService } from '@/services/bluesky-sync.service'

const task = Effect.gen(function* () {
  const sync = yield* BlueskySyncService
  const accounts = yield* Effect.tryPromise({
    try: () =>
      db
        .select({ accountId: externalAccounts.id, userId: externalAccounts.userId })
        .from(externalAccounts)
        .innerJoin(blueskySyncStates, eq(blueskySyncStates.externalAccountId, externalAccounts.id))
        .where(
          and(
            eq(externalAccounts.provider, 'bluesky'),
            eq(externalAccounts.status, 'active'),
            eq(blueskySyncStates.scheduled, true),
            or(
              isNull(blueskySyncStates.nextEligibleAt),
              lte(blueskySyncStates.nextEligibleAt, new Date())
            )
          )
        ),
    catch: () => new Error('Unable to enumerate scheduled Bluesky accounts')
  })

  yield* Effect.forEach(
    accounts,
    (account) =>
      sync.sync(account).pipe(
        Effect.tap((summary) =>
          Effect.logInfo('Bluesky scheduled sync completed', {
            accountId: account.accountId,
            runId: summary.runId,
            created: summary.created,
            conflicted: summary.conflicted
          })
        ),
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* Effect.tryPromise({
              try: async () => {
                const [state] = await db
                  .select({ consecutiveFailures: blueskySyncStates.consecutiveFailures })
                  .from(blueskySyncStates)
                  .where(eq(blueskySyncStates.externalAccountId, account.accountId))
                  .limit(1)
                const consecutiveFailures = (state?.consecutiveFailures ?? 0) + 1
                const disabled = consecutiveFailures >= 5
                await db
                  .update(blueskySyncStates)
                  .set({
                    consecutiveFailures,
                    scheduled: !disabled,
                    nextEligibleAt: disabled
                      ? null
                      : new Date(
                          Date.now() + Math.min(60 * 60 * 1000, 2 ** consecutiveFailures * 60_000)
                        ),
                    updatedAt: new Date()
                  })
                  .where(eq(blueskySyncStates.externalAccountId, account.accountId))
              },
              catch: () => new Error('Unable to record scheduled sync failure')
            }).pipe(Effect.catch(() => Effect.void))
            yield* Effect.logError('Bluesky scheduled sync failed', {
              accountId: account.accountId,
              error
            })
          })
        )
      ),
    { concurrency: 1 }
  )
})

await Effect.runPromise(task.pipe(Effect.provide(AppLayer)))
