import { eq } from 'drizzle-orm'
import type { DatabaseClient } from './layer'
import { user as userTable } from './auth.schema'

export const getUserByEmail = async (db: DatabaseClient, email: string) => {
  const user = await db.select().from(userTable).where(eq(userTable.email, email))
  return user
}

export const getUserById = async (db: DatabaseClient, id: string) => {
  const user = await db.select().from(userTable).where(eq(userTable.id, id))
  return user
}

export const getUserByEmailOrId = async (
  db: DatabaseClient,
  { email, userId }: { email?: string; userId?: string }
) => {
  if (email) return db.select().from(userTable).where(eq(userTable.email, email))
  if (userId) return db.select().from(userTable).where(eq(userTable.id, userId))
  return Promise.resolve([])
}
