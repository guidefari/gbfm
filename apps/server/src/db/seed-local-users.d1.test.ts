import { verifyPassword } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createMigratedD1Database, type MigratedD1Database } from '@/test/migrate-d1'

import { account, user } from './auth.schema'
import { makeDatabaseClient, type DatabaseClient } from './layer'
import { localUsers, seedLocalUsers } from './seed-local-users'

describe('local user seed', () => {
  let resource: MigratedD1Database
  let database: DatabaseClient

  beforeAll(async () => {
    resource = await createMigratedD1Database()
    database = makeDatabaseClient(resource.database)
  })

  afterAll(async () => resource.dispose())

  test('creates one sign-in-ready account for every RBAC role and is idempotent', async () => {
    const first = await seedLocalUsers(database)
    const second = await seedLocalUsers(database)

    expect(second).toEqual(first)
    expect(first.users.map(({ role }) => role)).toEqual(['user', 'creator', 'editor', 'admin'])

    for (const fixture of localUsers) {
      const [seededUser] = await database.select().from(user).where(eq(user.email, fixture.email))

      if (!seededUser) throw new Error(`Missing seeded user ${fixture.email}`)
      expect(seededUser).toMatchObject({
        name: fixture.name,
        emailVerified: true,
        username: fixture.username,
        role: fixture.role,
        banned: false,
      })

      const [credentials] = await database
        .select()
        .from(account)
        .where(eq(account.userId, seededUser.id))

      if (!credentials) throw new Error(`Missing credential account ${fixture.email}`)
      expect(credentials.providerId).toBe('credential')
      await expect(
        verifyPassword({ hash: credentials.password ?? '', password: first.password }),
      ).resolves.toBe(true)
    }

    await expect(database.$count(user)).resolves.toBe(localUsers.length)
    await expect(database.$count(account)).resolves.toBe(localUsers.length)
  })
})
