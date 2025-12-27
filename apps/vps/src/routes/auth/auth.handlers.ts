import { eq } from 'drizzle-orm'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import {
  user as userTable
} from '@/db/auth.schema'
import type { AppRouteHandler } from '@/lib/types'

import {
  getOrCreateEmailPreferencesByUserId,
  updateEmailPreferences as updateEmailPreferencesRepo
} from '@/repositories/email-preferences.repository'

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

  try {
    const [updated] = await db
      .update(userTable)
      .set(updateData)
      .where(eq(userTable.id, user.id))
      .returning()
    if (!updated) {
      return c.json({ error: 'User not found' }, HttpStatusCodes.NOT_FOUND)
    }
    return c.json(updated, HttpStatusCodes.OK)
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

  return c.json(
    {
      ...user,
      username: user.name,
      avatarUrl: user.image ?? null,
      image: user.image ?? null,
      verified: user.emailVerified,
      emailVerified: user.emailVerified
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
    const updatedPreferences = await updateEmailPreferencesRepo(
      user.id,
      updates
    )

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
