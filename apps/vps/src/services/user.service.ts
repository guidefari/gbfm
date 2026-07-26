import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { audioCreators, audioTable } from '@/db/audio.schema'
import {
  SOCIAL_LINK_PLATFORMS,
  type SocialLinkPlatform,
  userSocialLinks,
  user as userTable
} from '@/db/auth.schema'
import type { InsertAuthorEmailPreferences, SelectAuthorEmailPreferences } from '@/db/email.schema'
import { DatabaseError, getErrorMessage, NotFoundError } from '@/errors'
import {
  getOrCreateEmailPreferencesByUserId,
  updateEmailPreferences as updateEmailPreferencesRepo
} from '@/repositories/email-preferences.repository'

function isSocialLinkPlatform(value: string): value is SocialLinkPlatform {
  return SOCIAL_LINK_PLATFORMS.some((platform) => platform === value)
}

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
      bio: string | null
      role: string
      banned: boolean
      banReason: string | null
      banExpires: Date | null
      createdAt: Date
      updatedAt: Date
    },
    DatabaseError | NotFoundError
  >

  readonly searchUsers: (query: string) => Effect.Effect<
    Array<{
      id: string
      name: string
      username: string | null
      image: string | null
    }>,
    DatabaseError
  >

  readonly updateUserProfile: (
    userId: string,
    data: {
      email?: string
      image?: string | null
      username?: string
      bio?: string | null
    }
  ) => Effect.Effect<
    {
      id: string
      name: string
      email: string
      emailVerified: boolean
      image: string | null
      username: string | null
      bio: string | null
      role: string
      banned: boolean
      banReason: string | null
      banExpires: Date | null
      createdAt: Date
      updatedAt: Date
    },
    DatabaseError | NotFoundError
  >

  readonly getUserSocialLinks: (userId: string) => Effect.Effect<
    Array<{
      platform: SocialLinkPlatform
      url: string
      position: number
    }>,
    DatabaseError | NotFoundError
  >

  readonly replaceUserSocialLinks: (
    userId: string,
    links: Array<{
      platform: SocialLinkPlatform
      url: string
      position: number
    }>
  ) => Effect.Effect<
    Array<{
      platform: SocialLinkPlatform
      url: string
      position: number
    }>,
    DatabaseError | NotFoundError
  >

  readonly listDjs: () => Effect.Effect<
    Array<{
      id: string
      name: string
      username: string | null
      image: string | null
      bio: string | null
      mixCount: number
    }>,
    DatabaseError
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
export const UserService = Context.Service<UserService>('UserService')

// Core service logic - pure Effects with no service dependencies
const getUserByIdEffect = (userId: string) =>
  Effect.gen(function* () {
    const userRecords = yield* Effect.tryPromise({
      try: () => db.select().from(userTable).where(eq(userTable.id, userId)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user: ${getErrorMessage(error)}`,
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
    email?: string
    image?: string | null
    username?: string
    bio?: string | null
  }
) =>
  Effect.gen(function* () {
    // Check if user exists
    yield* getUserByIdEffect(userId)

    // Update user profile
    const updatedRecords = yield* Effect.tryPromise({
      try: () => db.update(userTable).set(data).where(eq(userTable.id, userId)).returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to update user profile: ${getErrorMessage(error)}`,
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

const searchUsersEffect = (query: string) =>
  Effect.gen(function* () {
    const searchPattern = `%${query}%`

    const users = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: userTable.id,
            name: userTable.name,
            username: userTable.username,
            image: userTable.image
          })
          .from(userTable)
          .where(or(ilike(userTable.name, searchPattern), ilike(userTable.username, searchPattern)))
          .limit(10),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to search users: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'user'
        })
    })

    return users
  })

const getUserEmailPreferencesEffect = (userId: string) =>
  Effect.tryPromise({
    try: () => getOrCreateEmailPreferencesByUserId(userId),
    catch: (error) =>
      new DatabaseError({
        message: `Failed to get user email preferences: ${getErrorMessage(error)}`,
        operation: 'select',
        table: 'user_email_preferences'
      })
  })

const getUserSocialLinksEffect = (userId: string) =>
  Effect.gen(function* () {
    yield* getUserByIdEffect(userId)

    const links = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            platform: userSocialLinks.platform,
            url: userSocialLinks.url,
            position: userSocialLinks.position
          })
          .from(userSocialLinks)
          .where(eq(userSocialLinks.userId, userId))
          .orderBy(asc(userSocialLinks.position)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user social links: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'user_social_links'
        })
    })

    return links.flatMap((link) =>
      isSocialLinkPlatform(link.platform)
        ? [{ platform: link.platform, url: link.url, position: link.position }]
        : []
    )
  })

const replaceUserSocialLinksEffect = (
  userId: string,
  links: Array<{
    platform: SocialLinkPlatform
    url: string
    position: number
  }>
) =>
  Effect.gen(function* () {
    yield* getUserByIdEffect(userId)

    const updatedLinks = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          await tx.delete(userSocialLinks).where(eq(userSocialLinks.userId, userId))

          if (links.length > 0) {
            await tx.insert(userSocialLinks).values(
              links.map((link) => ({
                userId,
                platform: link.platform,
                url: link.url,
                position: link.position
              }))
            )
          }

          return tx
            .select({
              platform: userSocialLinks.platform,
              url: userSocialLinks.url,
              position: userSocialLinks.position
            })
            .from(userSocialLinks)
            .where(eq(userSocialLinks.userId, userId))
            .orderBy(asc(userSocialLinks.position))
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to replace user social links: ${getErrorMessage(error)}`,
          operation: 'update',
          table: 'user_social_links'
        })
    })

    return updatedLinks.flatMap((link) =>
      isSocialLinkPlatform(link.platform)
        ? [{ platform: link.platform, url: link.url, position: link.position }]
        : []
    )
  })

const listDjsEffect = () =>
  Effect.gen(function* () {
    const mixCountExpr = sql<number>`count(${audioTable.id})::int`

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: userTable.id,
            name: userTable.name,
            username: userTable.username,
            image: userTable.image,
            bio: userTable.bio,
            mixCount: mixCountExpr
          })
          .from(userTable)
          .innerJoin(audioCreators, eq(audioCreators.creatorId, userTable.id))
          .innerJoin(audioTable, eq(audioTable.id, audioCreators.audioId))
          .where(and(eq(userTable.banned, false), eq(audioTable.draft, false)))
          .groupBy(userTable.id, userTable.name, userTable.username, userTable.image, userTable.bio)
          .orderBy(desc(mixCountExpr), asc(userTable.name)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to list djs: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'user'
        })
    })

    return rows
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
          message: `Failed to update user email preferences: ${getErrorMessage(error)}`,
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
export const UserServiceLayer = Layer.succeed(UserService, {
  getUserById: (userId) =>
    getUserByIdEffect(userId).pipe(Effect.withSpan('user.getById', { attributes: { userId } })),
  searchUsers: (query) =>
    searchUsersEffect(query).pipe(Effect.withSpan('user.searchUsers', { attributes: { query } })),
  updateUserProfile: (userId, data) =>
    updateUserProfileEffect(userId, data).pipe(
      Effect.withSpan('user.updateProfile', { attributes: { userId } })
    ),
  getUserSocialLinks: (userId) =>
    getUserSocialLinksEffect(userId).pipe(
      Effect.withSpan('user.getSocialLinks', { attributes: { userId } })
    ),
  replaceUserSocialLinks: (userId, links) =>
    replaceUserSocialLinksEffect(userId, links).pipe(
      Effect.withSpan('user.replaceSocialLinks', { attributes: { userId } })
    ),
  listDjs: () => listDjsEffect().pipe(Effect.withSpan('user.listDjs')),
  getUserEmailPreferences: (userId) =>
    getUserEmailPreferencesEffect(userId).pipe(
      Effect.withSpan('user.getEmailPreferences', { attributes: { userId } })
    ),
  updateUserEmailPreferences: (userId, preferences) =>
    updateUserEmailPreferencesEffect(userId, preferences).pipe(
      Effect.withSpan('user.updateEmailPreferences', { attributes: { userId } })
    )
})
