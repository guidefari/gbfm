import { randomUUID } from 'node:crypto'
import { sendPasswordResetEmail, sendWelcomeEmail } from '@gbfm/email/index'
import { and, eq } from 'drizzle-orm'
import { sign, verify } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { getAuthorByEmailOrId } from '@/db/author.repo'
import {
  authorPasswordResetTokensTable,
  authorSessionsTable,
  authorsTable,
  type UpdateProfileSchema
} from '@/db/author.schema'
import { env } from '@/env'
import type { AppRouteHandler } from '@/lib/types'

import type {
  CreateUserRoute,
  ForgotPasswordRoute,
  GetProfileRoute,
  ListUsersRoute,
  RefreshTokenRoute,
  ResetPasswordRoute,
  SigninRoute,
  SignupRoute,
  UpdateProfileRoute
} from './auth.routes'
import { isUsernameAvailable, uploadAvatar } from './auth.util'

const ACCESS_TOKEN_EXPIRES_IN = 60 * 15 // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7 // 7 days

export const signup: AppRouteHandler<SignupRoute> = async (c) => {
  const validated = c.req.valid('json')

  if (validated.username) {
    const existingUser = await db
      .select()
      .from(authorsTable)
      .where(eq(authorsTable.username, validated.username))

    if (existingUser.length > 0) {
      return c.json(
        {
          error: 'Username already taken'
        },
        HttpStatusCodes.BAD_REQUEST
      )
    }
  }

  const hashedPassword = await Bun.password.hash(validated.password)

  const [newAuthor] = await db
    .insert(authorsTable)
    .values({
      username: validated.username || validated.email,
      password: hashedPassword,
      name: validated.username || validated.email,
      email: validated.email
    })
    .returning()

  if (!newAuthor) {
    return c.json(
      { error: 'Failed to create user' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  await sendWelcomeEmail({
    to: validated.email,
    username: validated.username || validated.email,
    loginUrl: `${env.FRONTEND_URL}/auth/signin`
  })

  const { password, ...authorWithoutPassword } = newAuthor

  return c.json(
    {
      message: 'Signup successful',
      user: authorWithoutPassword
    },
    HttpStatusCodes.CREATED
  )
}

export const signin: AppRouteHandler<SigninRoute> = async (c) => {
  const validated = c.req.valid('json')

  const author = await getAuthorByEmailOrId({ email: validated.email })

  if (author.length === 0 || !author[0]?.password) {
    return c.json(
      { error: 'Invalid username or password' },
      HttpStatusCodes.UNAUTHORIZED
    )
  }

  const isPasswordValid = await Bun.password.verify(
    validated.password,
    author[0].password
  )

  if (!isPasswordValid) {
    return c.json(
      { error: 'Invalid username or password' },
      HttpStatusCodes.UNAUTHORIZED
    )
  }

  const currentAuthor = author[0]
  const { password, ...authorWithoutPassword } = currentAuthor

  const now = Math.floor(Date.now() / 1000)
  const accessToken = await sign(
    {
      sub: currentAuthor.id,
      email: currentAuthor.email,
      type: 'access',
      exp: now + ACCESS_TOKEN_EXPIRES_IN,
      iat: now
    },
    env.ACCESS_TOKEN_SECRET
  )

  const refreshToken = await sign(
    {
      sub: currentAuthor.id,
      email: currentAuthor.email,
      type: 'refresh',
      exp: now + REFRESH_TOKEN_EXPIRES_IN,
      iat: now
    },
    env.REFRESH_TOKEN_SECRET
  )

  const userAgent = c.req.header('user-agent')
  const forwarded = c.req.header('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : undefined

  await db.insert(authorSessionsTable).values({
    authorId: currentAuthor.id,
    refreshToken,
    userAgent,
    ip,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000)
  })

  return c.json(
    {
      user: authorWithoutPassword,
      accessToken,
      refreshToken
    },
    HttpStatusCodes.OK
  )
}

export const forgotPassword: AppRouteHandler<ForgotPasswordRoute> = async (
  c
) => {
  const validated = c.req.valid('json')

  const author = await db
    .select()
    .from(authorsTable)
    .where(eq(authorsTable.email, validated.email))

  if (author.length === 0 || !author[0]) {
    return c.json({ error: 'User not found' }, HttpStatusCodes.NOT_FOUND)
  }

  const currentAuthor = author[0]

  await db
    .delete(authorPasswordResetTokensTable)
    .where(eq(authorPasswordResetTokensTable.authorId, currentAuthor.id))

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60)

  await db.insert(authorPasswordResetTokensTable).values({
    authorId: currentAuthor.id,
    token,
    expiresAt
  })

  await sendPasswordResetEmail({
    to: validated.email,
    resetUrl: `${env.FRONTEND_URL}/auth/reset-password?token=${token}&email=${validated.email}`,
    expiresIn: '1 hour'
  })

  return c.json({ message: 'Password reset email sent' }, HttpStatusCodes.OK)
}

export const resetPassword: AppRouteHandler<ResetPasswordRoute> = async (c) => {
  const validated = c.req.valid('json')

  if (!validated.email && !validated.authorId) {
    return c.json(
      { error: 'Email or authorId is required' },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  const author = await getAuthorByEmailOrId({
    email: validated.email,
    authorId: validated.authorId
  })

  if (author.length === 0 || !author[0]) {
    return c.json(
      { error: 'Invalid email or authorId' },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  const currentAuthor = author[0]

  const tokenRow = await db
    .select()
    .from(authorPasswordResetTokensTable)
    .where(
      and(
        eq(authorPasswordResetTokensTable.token, validated.token),
        eq(authorPasswordResetTokensTable.authorId, currentAuthor.id)
      )
    )

  if (tokenRow.length === 0 || !tokenRow[0]) {
    return c.json(
      { error: 'Invalid or expired token' },
      HttpStatusCodes.UNAUTHORIZED
    )
  }

  const { authorId, expiresAt } = tokenRow[0]
  if (new Date(expiresAt) < new Date()) {
    return c.json({ error: 'Token expired' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const hashedPassword = await Bun.password.hash(validated.password)

  await db
    .update(authorsTable)
    .set({ password: hashedPassword })
    .where(eq(authorsTable.id, authorId))

  await db
    .delete(authorPasswordResetTokensTable)
    .where(eq(authorPasswordResetTokensTable.authorId, authorId))

  return c.json({ message: 'Password reset successful' }, HttpStatusCodes.OK)
}

export const refreshToken: AppRouteHandler<RefreshTokenRoute> = async (c) => {
  const { refreshToken } = c.req.valid('json')

  if (!refreshToken) {
    return c.json(
      { error: 'Refresh token required' },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  let payload: JWTPayload
  try {
    payload = await verify(refreshToken, env.REFRESH_TOKEN_SECRET)
  } catch {
    return c.json(
      { error: 'Invalid refresh token' },
      HttpStatusCodes.UNAUTHORIZED
    )
  }

  const session = await db
    .select()
    .from(authorSessionsTable)
    .where(eq(authorSessionsTable.refreshToken, refreshToken))

  if (
    session.length === 0 ||
    !session[0] ||
    new Date(session[0].expiresAt) < new Date()
  ) {
    return c.json(
      { error: 'Session expired or not found' },
      HttpStatusCodes.UNAUTHORIZED
    )
  }

  const authorId = payload.sub

  if (!authorId || typeof authorId !== 'string') {
    return c.json({ error: 'Invalid payload' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const author = await getAuthorByEmailOrId({ authorId })

  if (author.length === 0 || !author[0]) {
    return c.json({ error: 'User not found' }, HttpStatusCodes.NOT_FOUND)
  }

  const currentAuthor = author[0]

  const now = Math.floor(Date.now() / 1000)
  const accessToken = await sign(
    {
      sub: currentAuthor.id,
      email: currentAuthor.email,
      type: 'access',
      exp: now + ACCESS_TOKEN_EXPIRES_IN,
      iat: now
    },
    env.ACCESS_TOKEN_SECRET
  )

  return c.json({ accessToken }, HttpStatusCodes.OK)
}

// User management handlers
export const createUser: AppRouteHandler<CreateUserRoute> = async (c) => {
  const validated = c.req.valid('json')

  const hashedPassword = await Bun.password.hash(validated.password)

  try {
    const [newAuthor] = await db
      .insert(authorsTable)
      .values({ ...validated, password: hashedPassword })
      .returning()

    if (!newAuthor) {
      return c.json(
        { error: 'Failed to create user' },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      )
    }

    const { password: _, ...authorWithoutPassword } = newAuthor
    return c.json(authorWithoutPassword, HttpStatusCodes.CREATED)
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return c.json({ error: error.message }, HttpStatusCodes.CONFLICT)
    }

    return c.json(
      { error: 'Failed to create user' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const listUsers: AppRouteHandler<ListUsersRoute> = async (c) => {
  const authors = await db.select().from(authorsTable)
  const authorsWithoutPasswords = authors.map(
    ({ password, ...author }) => author
  )
  return c.json(authorsWithoutPasswords, HttpStatusCodes.OK)
}

export const updateProfile: AppRouteHandler<UpdateProfileRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  let updateData: UpdateProfileSchema = {}
  let avatarFile: File | null = null
  const contentType = c.req.header('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData()

    for (const [key, value] of formData.entries()) {
      if (
        key === 'avatar' &&
        value &&
        typeof value === 'object' &&
        'arrayBuffer' in value
      ) {
        avatarFile = value as File
      } else if (typeof value === 'string' && key !== 'avatar') {
        ;(updateData as any)[key] = value
      }
    }
  } else {
    updateData = { ...c.req.valid('json') }
  }

  if (updateData.username) {
    const isAvailable = await isUsernameAvailable(updateData.username)
    if (!isAvailable) {
      return c.json(
        { error: 'Username already taken' },
        HttpStatusCodes.BAD_REQUEST
      )
    }
  }

  if (updateData.password) {
    updateData.password = await Bun.password.hash(updateData.password)
  }

  if (avatarFile) {
    updateData.avatarUrl = await uploadAvatar(avatarFile)
  }

  try {
    const [updated] = await db
      .update(authorsTable)
      .set(updateData)
      .where(eq(authorsTable.id, user.id))
      .returning()
    if (!updated) {
      return c.json({ error: 'User not found' }, HttpStatusCodes.NOT_FOUND)
    }
    const { password, ...authorWithoutPassword } = updated
    return c.json(authorWithoutPassword, HttpStatusCodes.OK)
  } catch (error) {
    console.error('error:', error)
    return c.json(
      { error: 'Failed to update profile' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getProfile: AppRouteHandler<GetProfileRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.NOT_FOUND)
  }

  return c.json(user, HttpStatusCodes.OK)
}
