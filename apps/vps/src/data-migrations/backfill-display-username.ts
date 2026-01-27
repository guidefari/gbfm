import { and, isNotNull, isNull, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '@/db'
import { user as userTable } from '@/db/auth.schema'
import { DatabaseError } from '@/errors'

export const backfillDisplayUsername = Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () =>
      db
        .update(userTable)
        .set({ displayUsername: sql`${userTable.name}` })
        .where(
          and(isNull(userTable.displayUsername), isNotNull(userTable.name))
        ),
    catch: (error) =>
      new DatabaseError({
        message: `Backfill displayUsername failed: ${error}`,
        operation: 'backfill-display-username'
      })
  })

  const count = result.rowCount ?? 0
  if (count > 0) {
    yield* Effect.log(`Backfilled displayUsername for ${count} users`)
  }
})
