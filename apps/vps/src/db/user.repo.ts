import { eq } from 'drizzle-orm'
import { usersTable } from './user.schema'
import { db } from './index'

export const getUserByEmail = async (email: string) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
  return user
}

export const getUserById = async (id: string) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
  return user
}

export const getUserByEmailOrId = async ({
  email,
  userId
}: {
  email?: string
  userId?: string
}) => {
  if (email)
    return db.select().from(usersTable).where(eq(usersTable.email, email))
  if (userId)
    return db.select().from(usersTable).where(eq(usersTable.id, userId))
  return Promise.resolve([])
}
