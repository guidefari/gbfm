import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { AppRuntime, runApp } from '@/runtime'
import { ShowSubscriptionService } from '@/services/show.service'
import { UserService } from '@/services/user.service'

import type {
  GetAdminUserBioRoute,
  GetAdminUserSocialLinksRoute,
  GetEmailPreferencesRoute,
  GetProfileRoute,
  GetSocialLinksRoute,
  GetUserSubscriptionsRoute,
  ListDjsRoute,
  ReplaceAdminUserSocialLinksRoute,
  ReplaceSocialLinksRoute,
  SearchUsersRoute,
  UpdateAdminUserBioRoute,
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
    email?: string
    image?: string
    username?: string
    bio?: string
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
        if (key === 'email' || key === 'username' || key === 'bio') {
          updateData[key] = value
        }
      }
    }
  } else {
    const body = c.req.valid('json')
    if (body.email) updateData.email = body.email
    if (body.username) updateData.username = body.username
    if (body.bio !== undefined) updateData.bio = body.bio
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
    const [profile, socialLinks] = yield* Effect.all([
      userService.getUserById(user.id),
      userService.getUserSocialLinks(user.id)
    ])
    return { profile, socialLinks }
  }).pipe(
    Effect.withSpan('api.user.getProfile'),
    Effect.map(
      (data) =>
        ({
          data: {
            ...data.profile,
            username: data.profile.username,
            avatarUrl: data.profile.image,
            image: data.profile.image,
            verified: data.profile.emailVerified,
            emailVerified: data.profile.emailVerified,
            socialLinks: data.socialLinks
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

export const getSocialLinks: AppRouteHandler<GetSocialLinksRoute> = async (
  c
) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.getUserSocialLinks(user.id)
  }).pipe(
    Effect.withSpan('api.user.getSocialLinks'),
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to fetch social links',
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

export const replaceSocialLinks: AppRouteHandler<
  ReplaceSocialLinksRoute
> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const links = c.req.valid('json')

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.replaceUserSocialLinks(user.id, links)
  }).pipe(
    Effect.withSpan('api.user.replaceSocialLinks'),
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to replace social links',
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

export const getAdminUserSocialLinks: AppRouteHandler<
  GetAdminUserSocialLinksRoute
> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, HttpStatusCodes.FORBIDDEN)
  }

  const { userId } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.getUserSocialLinks(userId)
  }).pipe(
    Effect.withSpan('api.user.getAdminUserSocialLinks'),
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to fetch admin social links',
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

export const replaceAdminUserSocialLinks: AppRouteHandler<
  ReplaceAdminUserSocialLinksRoute
> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, HttpStatusCodes.FORBIDDEN)
  }

  const { userId } = c.req.valid('param')
  const links = c.req.valid('json')

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.replaceUserSocialLinks(userId, links)
  }).pipe(
    Effect.withSpan('api.user.replaceAdminUserSocialLinks'),
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to replace admin social links',
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

export const updateAdminUserBio: AppRouteHandler<
  UpdateAdminUserBioRoute
> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, HttpStatusCodes.FORBIDDEN)
  }

  const { userId } = c.req.valid('param')
  const { bio } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    const updated = yield* userService.updateUserProfile(userId, {
      bio: bio ?? undefined
    })
    return { bio: updated.bio }
  }).pipe(
    Effect.withSpan('api.user.updateAdminUserBio'),
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to update admin user bio',
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

export const getAdminUserBio: AppRouteHandler<GetAdminUserBioRoute> = async (
  c
) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, HttpStatusCodes.FORBIDDEN)
  }

  const { userId } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    const targetUser = yield* userService.getUserById(userId)
    return { bio: targetUser.bio }
  }).pipe(
    Effect.withSpan('api.user.getAdminUserBio'),
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to fetch admin user bio',
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
    const subscriptionService = yield* ShowSubscriptionService
    return yield* subscriptionService.getUserSubscriptions(user.id, {
      limit,
      offset
    })
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

export const listDjs: AppRouteHandler<ListDjsRoute> = async (c) => {
  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.listDjs()
  }).pipe(
    Effect.withSpan('api.user.listDjs'),
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to list DJs',
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
