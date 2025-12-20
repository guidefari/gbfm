import { db } from '../src/db'
import { usersTable } from '../src/db/user.schema'
import { user as betterAuthUser, account as betterAuthAccount } from '../src/db/auth.schema'
import { Effect, Console } from 'effect'
import { BunRuntime } from '@effect/platform-bun'

const migrateUsers = Effect.gen(function* () {
  yield* Console.log('🔄 Starting user migration from old auth to Better Auth...')

  const existingUsers = yield* Effect.promise(() =>
    db.select().from(usersTable)
  )

  yield* Console.log(`Found ${existingUsers.length} users to migrate`)

  let successCount = 0
  let errorCount = 0

  for (const oldUser of existingUsers) {
    const userId = oldUser.id

    yield* Console.log(`Migrating user: ${oldUser.email} (${userId})`)

    const result = yield* Effect.tryPromise({
      try: async () => {
        await db.transaction(async (tx) => {
          await tx.insert(betterAuthUser).values({
            id: userId,
            name: oldUser.name,
            email: oldUser.email,
            emailVerified: oldUser.verified,
            image: oldUser.avatarUrl,
            createdAt: oldUser.createdAt,
            updatedAt: oldUser.updatedAt
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
      catch: (error) => error
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

    if (result.success) {
      yield* Console.log(`✓ Successfully migrated ${oldUser.email}`)
    } else {
      yield* Console.error(`✗ Failed to migrate ${oldUser.email}:`, result.error)
    }
  }

  yield* Console.log(`\n✅ Migration complete!`)
  yield* Console.log(`   Successful: ${successCount}`)
  yield* Console.log(`   Failed: ${errorCount}`)
  yield* Console.log(`   Total: ${existingUsers.length}`)
})

migrateUsers.pipe(BunRuntime.runMain)
