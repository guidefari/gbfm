import { generateId } from "lucia"
import { hash } from "@node-rs/argon2"

import type { NextApiRequest, NextApiResponse } from "next"
import { lucia } from "@/db/auth"
import { insertUser } from "@/db/schema"
import { z } from "zod"
import { captureException } from "@sentry/nextjs"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.status(404).end()
    return
  }

  const body: null | Partial<{
    email: string
    password: string
    username: string
  }> = req.body
  const email = body?.email
  const password = body?.password
  const username = body?.username

  const emailSchema = z.string().email()
  const usernameSchema = z.string().min(3).max(64)

  const validatedUser = usernameSchema.safeParse(username)
  const validatedEmail = emailSchema.safeParse(email)

  if (username && !validatedUser.success) {
    return res.status(400).json({
      message: "Invalid username",
    })
  }

  if (!email || !validatedEmail.success) {
    res.status(400).json({
      message: "Invalid email",
    })
    return
  }
  if (!password || password.length < 6 || password.length > 255) {
    res.status(400).json({
      message: "Invalid password",
    })
    return
  }

  const passwordHash = await hash(password, {
    // recommended minimum parameters
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  })
  const userId = generateId(15)

  try {
    const insertResult = await insertUser({
      email,
      id: userId,
      password: passwordHash,
      //TODO: don't insert this field if username is empty string
      username,
    })

    console.log({ insertResult })

    const session = await lucia.createSession(userId, {})
    res
      .appendHeader(
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize()
      )
      .status(200)
      .json(insertResult[0])
    return
  } catch (e) {
    // check for specific e.code when item already exists
    if (typeof e === "object" && e?.code === "23505") {
      console.log(e)
      res.status(400).json({
        message: "email/username already exists",
      })
      return
    }
    captureException(e)

    res.status(500).json({
      message: "An unknown error occurred",
      stack: e,
    })
    return
  }
}
