import { hashPassword } from 'better-auth/crypto'
import { and, eq } from 'drizzle-orm'
import { account, user } from './auth.schema'
import type { DatabaseClient } from './layer'

const localPassword = 'LocalTest123!'

export const localUsers = [
  {
    name: 'Local Listener',
    email: 'listener@gbfm.local',
    username: 'local-listener',
    role: 'user'
  },
  {
    name: 'Local Creator',
    email: 'creator@gbfm.local',
    username: 'local-creator',
    role: 'creator'
  },
  { name: 'Local Editor', email: 'editor@gbfm.local', username: 'local-editor', role: 'editor' },
  { name: 'Local Admin', email: 'admin@gbfm.local', username: 'local-admin', role: 'admin' }
] as const

export type LocalUserRole = (typeof localUsers)[number]['role']

export const seedLocalUsers = async (database: DatabaseClient) => {
  const password = await hashPassword(localPassword)

  for (const fixture of localUsers) {
    const existing = await database
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, fixture.email))
    const userId = existing[0]?.id ?? crypto.randomUUID()

    await database
      .insert(user)
      .values({
        id: userId,
        name: fixture.name,
        email: fixture.email,
        emailVerified: true,
        username: fixture.username,
        displayUsername: fixture.username,
        role: fixture.role
      })
      .onConflictDoUpdate({
        target: user.email,
        set: {
          name: fixture.name,
          emailVerified: true,
          username: fixture.username,
          displayUsername: fixture.username,
          role: fixture.role,
          banned: false,
          banReason: null,
          banExpires: null,
          updatedAt: new Date()
        }
      })

    const credentials = await database
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))

    if (credentials[0]) {
      await database
        .update(account)
        .set({ password, updatedAt: new Date() })
        .where(eq(account.id, credentials[0].id))
    } else {
      await database.insert(account).values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password
      })
    }
  }

  return {
    password: localPassword,
    users: localUsers.map(({ email, role, username }) => ({ email, role, username }))
  }
}
