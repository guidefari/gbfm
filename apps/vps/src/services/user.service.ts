import { eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { user as userTable } from '@/db/auth.schema'
import type {
  InsertAuthorEmailPreferences,
  SelectAuthorEmailPreferences
} from '@/db/email.schema'
import { DatabaseError, NotFoundError } from '@/errors'
import {
  getOrCreateEmailPreferencesByUserId,
  updateEmailPreferences as updateEmailPreferencesRepo
} from '@/repositories/email-preferences.repository'

// Service interface
export interface UserService {
  readonly getUserById: (userId: string) => Effect.Effect<
    {
      id: string
      name: string
      email: string
      emailVerified: boolean
      image: string | null
      username: string | null
      displayUsername: string | null
      role: string
      banned: boolean
      banReason: string | null
      banExpires: Date | null
      createdAt: Date
      updatedAt: Date
    },
    DatabaseError | NotFoundError
  >

  readonly updateUserProfile: (
    userId: string,
    data: {
      name?: string
      email?: string
      image?: string
      username?: string
    }
  ) => Effect.Effect<
    {
      id: string
      name: string
      email: string
      emailVerified: boolean
      image: string | null
      username: string | null
      displayUsername: string | null
      role: string
      banned: boolean
      banReason: string | null
      banExpires: Date | null
      createdAt: Date
      updatedAt: Date
    },
    DatabaseError | NotFoundError
  >

  readonly getUserEmailPreferences: (
    userId: string
  ) => Effect.Effect<SelectAuthorEmailPreferences, DatabaseError>

  readonly updateUserEmailPreferences: (
    userId: string,
    preferences: Partial<InsertAuthorEmailPreferences>
  ) => Effect.Effect<SelectAuthorEmailPreferences, DatabaseError>
}

// Service tag for dependency injection
export const UserService = Context.GenericTag<UserService>('UserService')

// Core service logic - pure Effects with no service dependencies
const getUserByIdEffect = (userId: string) =>
  Effect.gen(function* () {
    const userRecords = yield* Effect.tryPromise({
      try: () =>
        db.select().from(userTable).where(eq(userTable.id, userId)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user: ${(error as Error).message}`,
          operation: 'select',
          table: 'user'
        })
    })

    const user = userRecords[0]
    if (!user) {
      return yield* new NotFoundError({
        message: 'User not found',
        resource: 'user',
        id: userId
      })
    }

    return user
  })

const updateUserProfileEffect = (
  userId: string,
  data: {
    name?: string
    email?: string
    image?: string
    username?: string
  }
) =>
  Effect.gen(function* () {
    // Check if user exists
    yield* getUserByIdEffect(userId)

    // Update user profile
    const updatedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .update(userTable)
          .set(data)
          .where(eq(userTable.id, userId))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to update user profile: ${(error as Error).message}`,
          operation: 'update',
          table: 'user'
        })
    })

    const user = updatedRecords[0]
    if (!user) {
      return yield* new NotFoundError({
        message: 'User not found',
        resource: 'user',
        id: userId
      })
    }

    return user
  })

const getUserEmailPreferencesEffect = (userId: string) =>
  Effect.tryPromise({
    try: () => getOrCreateEmailPreferencesByUserId(userId),
    catch: (error) =>
      new DatabaseError({
        message: `Failed to get user email preferences: ${(error as Error).message}`,
        operation: 'select',
        table: 'user_email_preferences'
      })
  })

const updateUserEmailPreferencesEffect = (
  userId: string,
  preferences: Partial<InsertAuthorEmailPreferences>
) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => updateEmailPreferencesRepo(userId, preferences),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to update user email preferences: ${(error as Error).message}`,
          operation: 'update',
          table: 'user_email_preferences'
        })
    })

    if (!result) {
      return yield* new DatabaseError({
        message: 'Failed to update email preferences - no rows affected',
        operation: 'update',
        table: 'user_email_preferences'
      })
    }

    return result
  })

// Implementation - simple layer that provides access to the Effects
export const UserServiceLive = Layer.succeed(UserService, {
  getUserById: (userId) =>
    getUserByIdEffect(userId).pipe(
      Effect.withSpan('user.getById', { attributes: { userId } })
    ),
  updateUserProfile: (userId, data) =>
    updateUserProfileEffect(userId, data).pipe(
      Effect.withSpan('user.updateProfile', { attributes: { userId } })
    ),
  getUserEmailPreferences: (userId) =>
    getUserEmailPreferencesEffect(userId).pipe(
      Effect.withSpan('user.getEmailPreferences', { attributes: { userId } })
    ),
  updateUserEmailPreferences: (userId, preferences) =>
    updateUserEmailPreferencesEffect(userId, preferences).pipe(
      Effect.withSpan('user.updateEmailPreferences', { attributes: { userId } })
    )
})
