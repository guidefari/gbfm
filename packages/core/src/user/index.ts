import { fn } from "@/util/fn"
import { z } from "zod"
import { insertUser, userTable } from "./user.sql"
import { and, eq } from "drizzle-orm"
import { db } from "../drizzle"
import { createID } from "@/util/id"

export namespace User {
  export const Info = z.object({
    id: z.string(),
    email: z.string().email(),
  })

  export const create = fn(Info.shape.email, async email => {
    const id = createID("user")
    const user = await insertUser({
      id,
      email,
    })

    return user
  })

  export const fromID = fn(Info.shape.id, async id =>
    db
      .select()
      .from(userTable)
      .where(eq(userTable.id, id))
      .then(rows => rows.map(serialize).at(0))
  )

  export const fromEmail = fn(Info.shape.email, async email =>
    db
      .select()
      .from(userTable)
      .where(and(eq(userTable.email, email)))
      .then(rows => rows.map(serialize).at(0))
  )

  function serialize(
    input: typeof userTable.$inferSelect
  ): z.infer<typeof Info> {
    return {
      id: input.id,
      email: input.email,
    }
  }
}
