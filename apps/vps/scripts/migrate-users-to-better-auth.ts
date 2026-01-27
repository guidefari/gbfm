import { db } from '../src/db'
import { sql } from 'drizzle-orm'
import { user as betterAuthUser, account as betterAuthAccount } from '../src/db/auth.schema'
import { Effect, Console, Data } from 'effect'
import { BunRuntime } from '@effect/platform-bun'

class FetchUsersError extends Data.TaggedError("FetchUsersError")<{
  readonly cause: unknown
}> {}

class MigrationError extends Data.TaggedError("MigrationError")<{
  readonly cause: unknown
}> {}

const migrateUsers = Effect.gen(function* () {
  yield* Console.log('🔄 Starting user migration from old auth to Better Auth...')

  const result = yield* Effect.tryPromise({
    try: () => db.execute(sql`SELECT * FROM "users"`),
    catch: (cause) => new FetchUsersError({ cause })
  })

  const existingUsers = result.rows as unknown as any[]

  yield* Console.log(`Found ${existingUsers.length} users to migrate`)

  let successCount = 0
  let errorCount = 0

  for (const oldUser of existingUsers) {
    const userId = oldUser.id

    yield* Console.log(`Migrating user: ${oldUser.email} (${userId})`)

    const migrationResult = yield* Effect.tryPromise({
      try: async () => {
        await db.transaction(async (tx) => {
          await tx.insert(betterAuthUser).values({
            id: userId,
            name: oldUser.name || '',
            email: oldUser.email,
            emailVerified: Boolean(oldUser.verified || oldUser.email_verified),
            image: oldUser.avatar_url || oldUser.image || null,
            createdAt: oldUser.created_at || oldUser.createdAt || new Date(),
            updatedAt: oldUser.updated_at || oldUser.updatedAt || new Date()
          })

          if (oldUser.password) {
            await tx.insert(betterAuthAccount).values({
              id: `${userId}-credential`,
              accountId: oldUser.email,
              providerId: 'credential',
              userId: userId,
              password: oldUser.password
            })
          }
        })
      },
      catch: (cause) => new MigrationError({ cause })
    }).pipe(
      Effect.match({
        onFailure: (error) => {
          errorCount++
          return { success: false, error }
        },
        onSuccess: () => {
          successCount++
          return { success: true }
        }
      })
    )

    if (migrationResult.success) {
      yield* Console.log(`✓ Successfully migrated ${oldUser.email}`)
    } else {
      const err = (migrationResult as any).error
      yield* Console.error(`✗ Failed to migrate ${oldUser.email}:`, err instanceof MigrationError ? String(err.cause) : err)
    }
  }

  yield* Console.log(`\n✅ Migration complete!`)
  yield* Console.log(`   Successful: ${successCount}`)
  yield* Console.log(`   Failed: ${errorCount}`)
  yield* Console.log(`   Total: ${existingUsers.length}`)
})

migrateUsers.pipe(BunRuntime.runMain)
