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
  UpdateEmailPreferencesRoute,
  UpdateProfileRoute
} from './user.routes'
import { uploadAvatar } from './user.util'

export const updateProfile: AppRouteHandler<UpdateProfileRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const updateData: Partial<{ name?: string; email?: string; image?: string }> =
    {}
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
        if (key === 'name' || key === 'email') {
          updateData[key] = value
        }
      }
    }
  } else {
    const body = c.req.valid('json')
    if (body.name) updateData.name = body.name
    if (body.email) updateData.email = body.email
  }

  if (avatarFile) {
    updateData.image = await uploadAvatar(avatarFile)
  }

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.updateUserProfile(user.id, updateData)
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    if (error._tag === 'NotFoundError') {
      return c.json({ error: error.message }, HttpStatusCodes.NOT_FOUND)
    }
    return c.json(
      { error: 'Failed to update profile' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json(result.right, HttpStatusCodes.OK)
}

export const getProfile: AppRouteHandler<GetProfileRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.NOT_FOUND)
  }

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.getUserById(user.id)
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    if (error._tag === 'NotFoundError') {
      return c.json({ error: error.message }, HttpStatusCodes.NOT_FOUND)
    }
    return c.json(
      { error: 'Failed to fetch profile' },
      HttpStatusCodes.NOT_FOUND
    )
  }

  return c.json(
    {
      ...result.right,
      username: result.right.name,
      avatarUrl: result.right.image,
      image: result.right.image,
      verified: result.right.emailVerified,
      emailVerified: result.right.emailVerified
    },
    HttpStatusCodes.OK
  )
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
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return c.json(
      { error: 'Failed to fetch email preferences' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json(result.right, HttpStatusCodes.OK)
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
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return c.json(
      { error: 'Failed to update email preferences' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json(result.right, HttpStatusCodes.OK)
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
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}
