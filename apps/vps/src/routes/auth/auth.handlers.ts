import { randomUUID } from 'node:crypto'
import { sendPasswordResetEmail, sendWelcomeEmail } from '@gbfm/email/index'
import { and, count, desc, eq } from 'drizzle-orm'
import { sign, verify } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import {
  EMAIL_DELIVERY_STATUSES,
  EMAIL_NOTIFICATION_TYPES
} from '@/db/email.schema'
import { getUserByEmailOrId } from '@/db/user.repo'
import {
  type UpdateProfileSchema,
  userPasswordResetTokensTable,
  userSessionsTable,
  usersTable
} from '@/db/user.schema'
import { env } from '@/env'
import { createPaginationMetadata } from '@/lib/pagination'
import type { AppRouteHandler } from '@/lib/types'
import {
  createEmailDeliveryLog,
  markEmailDeliveryLogAsFailed,
  markEmailDeliveryLogAsSent
} from '@/repositories/email-delivery-log.repository'

import {
  getOrCreateEmailPreferencesByUserId,
  updateEmailPreferences as updateEmailPreferencesRepo
} from '@/repositories/email-preferences.repository'

import type {
  CreateUserRoute,
  ForgotPasswordRoute,
  GetEmailPreferencesRoute,
  GetProfileRoute,
  ListUsersRoute,
  RefreshTokenRoute,
  ResetPasswordRoute,
  UpdateEmailPreferencesRoute,
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
      .from(usersTable)
      .where(eq(usersTable.username, validated.username))

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

  const [newUser] = await db
    .insert(usersTable)
    .values({
      username: validated.username || validated.email,
      password: hashedPassword,
      name: validated.username || validated.email,
      email: validated.email
    })
    .returning()

  if (!newUser) {
    return c.json(
      { error: 'Failed to create user' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  // Create email delivery log for welcome email
  const username = validated.username || validated.email
  const subject = `Welcome to goosebumps.fm, ${username}! 🎵`
  const welcomeEmailLog = await createEmailDeliveryLog({
    authorId: newUser.id,
    recipientEmail: validated.email,
    recipientName: username,
    emailType: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
    templateName: 'welcome',
    subject,
    status: EMAIL_DELIVERY_STATUSES.PENDING
  })

  try {
    await sendWelcomeEmail({
      to: validated.email,
      username,
      loginUrl: `${env.FRONTEND_URL}/auth/signin`
    })
    await markEmailDeliveryLogAsSent(welcomeEmailLog.id)
  } catch (emailError) {
    console.error('Failed to send welcome email:', emailError)
    await markEmailDeliveryLogAsFailed(
      welcomeEmailLog.id,
      emailError instanceof Error ? emailError.message : 'Unknown error'
    )
  }

  const { password, ...userWithoutPassword } = newUser

  return c.json(
    {
      message: 'Signup successful',
      user: userWithoutPassword
    },
    HttpStatusCodes.CREATED
  )
}

export const signin: AppRouteHandler<SigninRoute> = async (c) => {
  const validated = c.req.valid('json')

  const user = await getUserByEmailOrId({ email: validated.email })

  if (user.length === 0 || !user[0]?.password) {
    return c.json(
      { error: 'Invalid username or password' },
      HttpStatusCodes.UNAUTHORIZED
    )
  }

  const isPasswordValid = await Bun.password.verify(
    validated.password,
    user[0].password
  )

  if (!isPasswordValid) {
    return c.json(
      { error: 'Invalid username or password' },
      HttpStatusCodes.UNAUTHORIZED
    )
  }

  const currentUser = user[0]
  const { password, ...userWithoutPassword } = currentUser

  const now = Math.floor(Date.now() / 1000)
  const accessToken = await sign(
    {
      sub: currentUser.id,
      email: currentUser.email,
      type: 'access',
      exp: now + ACCESS_TOKEN_EXPIRES_IN,
      iat: now
    },
    env.ACCESS_TOKEN_SECRET
  )

  const refreshToken = await sign(
    {
      sub: currentUser.id,
      email: currentUser.email,
      type: 'refresh',
      exp: now + REFRESH_TOKEN_EXPIRES_IN,
      iat: now
    },
    env.REFRESH_TOKEN_SECRET
  )

  const userAgent = c.req.header('user-agent')
  const forwarded = c.req.header('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : undefined

  await db.insert(userSessionsTable).values({
    userId: currentUser.id,
    refreshToken,
    userAgent,
    ip,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000)
  })

  return c.json(
    {
      user: userWithoutPassword,
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

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, validated.email))

  if (user.length === 0 || !user[0]) {
    return c.json({ error: 'User not found' }, HttpStatusCodes.NOT_FOUND)
  }

  const currentUser = user[0]

  await db
    .delete(userPasswordResetTokensTable)
    .where(eq(userPasswordResetTokensTable.userId, currentUser.id))

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60)

  await db.insert(userPasswordResetTokensTable).values({
    userId: currentUser.id,
    token,
    expiresAt
  })

  // Create email delivery log for password reset email
  const resetEmailLog = await createEmailDeliveryLog({
    authorId: currentUser.id,
    recipientEmail: validated.email,
    recipientName: currentUser.name,
    emailType: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
    templateName: 'password-reset',
    subject: 'Reset your goosebumps.fm password',
    status: EMAIL_DELIVERY_STATUSES.PENDING,
    metadata: {
      tokenId: token
    }
  })

  try {
    await sendPasswordResetEmail({
      to: validated.email,
      resetUrl: `${env.FRONTEND_URL}/auth/reset-password?token=${token}&email=${validated.email}`,
      expiresIn: '1 hour'
    })
    await markEmailDeliveryLogAsSent(resetEmailLog.id)
  } catch (emailError) {
    console.error('Failed to send password reset email:', emailError)
    await markEmailDeliveryLogAsFailed(
      resetEmailLog.id,
      emailError instanceof Error ? emailError.message : 'Unknown error'
    )
  }

  return c.json({ message: 'Password reset email sent' }, HttpStatusCodes.OK)
}

export const resetPassword: AppRouteHandler<ResetPasswordRoute> = async (c) => {
  const validated = c.req.valid('json')

  if (!validated.email && !validated.userId) {
    return c.json(
      { error: 'Email or userId is required' },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  const user = await getUserByEmailOrId({
    email: validated.email,
    userId: validated.userId
  })

  if (user.length === 0 || !user[0]) {
    return c.json(
      { error: 'Invalid email or userId' },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  const currentUser = user[0]

  const tokenRow = await db
    .select()
    .from(userPasswordResetTokensTable)
    .where(
      and(
        eq(userPasswordResetTokensTable.token, validated.token),
        eq(userPasswordResetTokensTable.userId, currentUser.id)
      )
    )

  if (tokenRow.length === 0 || !tokenRow[0]) {
    return c.json(
      { error: 'Invalid or expired token' },
      HttpStatusCodes.UNAUTHORIZED
    )
  }

  const { userId, expiresAt } = tokenRow[0]
  if (new Date(expiresAt) < new Date()) {
    return c.json({ error: 'Token expired' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const hashedPassword = await Bun.password.hash(validated.password)

  await db
    .update(usersTable)
    .set({ password: hashedPassword })
    .where(eq(usersTable.id, userId))

  await db
    .delete(userPasswordResetTokensTable)
    .where(eq(userPasswordResetTokensTable.userId, userId))

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
    .from(userSessionsTable)
    .where(eq(userSessionsTable.refreshToken, refreshToken))

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

  const userId = payload.sub

  if (!userId || typeof userId !== 'string') {
    return c.json({ error: 'Invalid payload' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const user = await getUserByEmailOrId({ userId })

  if (user.length === 0 || !user[0]) {
    return c.json({ error: 'User not found' }, HttpStatusCodes.NOT_FOUND)
  }

  const currentUser = user[0]

  const now = Math.floor(Date.now() / 1000)
  const accessToken = await sign(
    {
      sub: currentUser.id,
      email: currentUser.email,
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
    const [newUser] = await db
      .insert(usersTable)
      .values({ ...validated, password: hashedPassword })
      .returning()

    if (!newUser) {
      return c.json(
        { error: 'Failed to create user' },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      )
    }

    const { password: _, ...userWithoutPassword } = newUser
    return c.json(userWithoutPassword, HttpStatusCodes.CREATED)
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
  const { limit, offset } = c.req.valid('query')

  // Get total count
  const countResult = await db.select({ total: count() }).from(usersTable)

  const total = countResult[0]?.total ?? 0

  // Get paginated data
  const users = await db
    .select()
    .from(usersTable)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(usersTable.createdAt))

  // Remove passwords from response
  const data = users.map(({ password, ...user }) => user)

  return c.json(
    {
      data,
      pagination: createPaginationMetadata(total, limit, offset)
    },
    HttpStatusCodes.OK
  )
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
        updateData[key as keyof UpdateProfileSchema] = value as never
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
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, user.id))
      .returning()
    if (!updated) {
      return c.json({ error: 'User not found' }, HttpStatusCodes.NOT_FOUND)
    }
    const { password, ...userWithoutPassword } = updated
    return c.json(userWithoutPassword, HttpStatusCodes.OK)
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

export const getEmailPreferences: AppRouteHandler<
  GetEmailPreferencesRoute
> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  try {
    const preferences = await getOrCreateEmailPreferencesByUserId(user.id)
    return c.json(preferences, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Failed to get email preferences:', error)
    return c.json(
      { error: 'Failed to get email preferences' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const updateEmailPreferences: AppRouteHandler<
  UpdateEmailPreferencesRoute
> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const updates = c.req.valid('json')

  try {
    const updatedPreferences = await updateEmailPreferencesRepo(user.id, updates)

    if (!updatedPreferences) {
      return c.json(
        { error: 'Failed to update email preferences' },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      )
    }

    return c.json(updatedPreferences, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Failed to update email preferences:', error)
    return c.json(
      { error: 'Failed to update email preferences' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
