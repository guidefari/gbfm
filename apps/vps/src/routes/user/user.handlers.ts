import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { AppRuntime, runApp } from '@/runtime'
import { ShowService } from '@/services/show.service'
import { UserService } from '@/services/user.service'

import type {
  GetEmailPreferencesRoute,
  GetProfileRoute,
  GetUserSubscriptionsRoute,
  SearchUsersRoute,
  UpdateEmailPreferencesRoute,
  UpdateProfileRoute
} from './user.routes'
import { uploadAvatar } from './user.util'

export const updateProfile: AppRouteHandler<UpdateProfileRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const updateData: Partial<{
    displayUsername?: string
    email?: string
    image?: string
    username?: string
  }> = {}
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
        if (
          key === 'displayUsername' ||
          key === 'email' ||
          key === 'username'
        ) {
          updateData[key] = value
        }
      }
    }
  } else {
    const body = c.req.valid('json')
    if (body.displayUsername) updateData.displayUsername = body.displayUsername
    if (body.email) updateData.email = body.email
    if (body.username) updateData.username = body.username
  }

  if (avatarFile) {
    updateData.image = await uploadAvatar(avatarFile)
  }

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.updateUserProfile(user.id, updateData)
  }).pipe(
    Effect.withSpan('api.user.updateProfile'),
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to update profile',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}

export const getProfile: AppRouteHandler<GetProfileRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.NOT_FOUND)
  }

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.getUserById(user.id)
  }).pipe(
    Effect.withSpan('api.user.getProfile'),
    Effect.map(
      (data) =>
        ({
          data: {
            ...data,
            username: data.username,
            avatarUrl: data.image,
            image: data.image,
            verified: data.emailVerified,
            emailVerified: data.emailVerified
          },
          status: HttpStatusCodes.OK
        }) as const
    ),
    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to fetch profile',
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}

export const getEmailPreferences: AppRouteHandler<
  GetEmailPreferencesRoute
> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.getUserEmailPreferences(user.id)
  }).pipe(
    Effect.withSpan('api.user.getEmailPreferences'),
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to fetch email preferences',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}

export const updateEmailPreferences: AppRouteHandler<
  UpdateEmailPreferencesRoute
> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const updates = c.req.valid('json')

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.updateUserEmailPreferences(user.id, updates)
  }).pipe(
    Effect.withSpan('api.user.updateEmailPreferences'),
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to update email preferences',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}

export const getUserSubscriptions: AppRouteHandler<
  GetUserSubscriptionsRoute
> = async (c) => {
  const { limit, offset } = c.req.valid('query')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.getUserSubscriptions(user.id, { limit, offset })
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    ),
    Effect.withSpan('api.user.getSubscriptions')
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

export const searchUsers: AppRouteHandler<SearchUsersRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const { q } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.searchUsers(q)
  }).pipe(
    Effect.withSpan('api.user.searchUsers'),
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to search users',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}
