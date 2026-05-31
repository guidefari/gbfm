import { eq } from 'drizzle-orm'
import { user as userTable } from './auth.schema'
import { db } from './index'

export const getUserByEmail = async (email: string) => {
  const user = await db.select().from(userTable).where(eq(userTable.email, email))
  return user
}

export const getUserById = async (id: string) => {
  const user = await db.select().from(userTable).where(eq(userTable.id, id))
  return user
}

export const getUserByEmailOrId = async ({
  email,
  userId
}: {
  email?: string
  userId?: string
}) => {
  if (email) return db.select().from(userTable).where(eq(userTable.email, email))
  if (userId) return db.select().from(userTable).where(eq(userTable.id, userId))
  return Promise.resolve([])
}
