import { db } from "./index";
import { authorsTable } from "./author.schema";
import { eq } from "drizzle-orm";

export const getAuthorByEmail = async (email: string) => {
  const author = await db.select().from(authorsTable).where(eq(authorsTable.email, email));
  return author;
}

export const getAuthorById = async (id: string) => {
  const author = await db.select().from(authorsTable).where(eq(authorsTable.id, id));
  return author;
}

export const getAuthorByEmailOrId = async ({email, authorId}: {email?: string, authorId?: string}) => {
    if (email)
      return db.select().from(authorsTable).where(eq(authorsTable.email, email))
    if (authorId)
      return db.select().from(authorsTable).where(eq(authorsTable.id, authorId))
    return Promise.resolve([])
  }