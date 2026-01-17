import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { user as userTable } from '@/db/auth.schema'
import { DatabaseError, NotFoundError } from '@/errors'
import type { AppRouteHandler } from '@/lib/types'
import {
  getOrCreateEmailPreferencesByUserId,
  updateEmailPreferences as updateEmailPreferencesRepo
} from '@/repositories/email-preferences.repository'
import { AppRuntime } from '@/runtime'
import { UserService } from '@/services/user.service'

import type {
  GetEmailPreferencesRoute,
  GetProfileRoute,
  UpdateEmailPreferencesRoute,
  UpdateProfileRoute
} from './auth.routes'
import { uploadAvatar } from './auth.util'

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
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
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

export const getProfile: AppRouteHandler<GetProfileRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.NOT_FOUND)
  }

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.getUserById(user.id)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(
    {
      ...result,
      username: result.name,
      avatarUrl: result.image,
      image: result.image,
      verified: result.emailVerified,
      emailVerified: result.emailVerified
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
