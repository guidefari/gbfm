import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { runEffect } from '@/lib/effect-hono'
import type { AppRouteHandler } from '@/lib/types'
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
      if (key === 'avatar' && value && typeof value === 'object' && 'arrayBuffer' in value) {
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
  }).pipe(Effect.withSpan('api.user.updateProfile'))

  return runEffect<UpdateProfileRoute>(c, program)
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
    return {
      ...profile,
      username: profile.username,
      avatarUrl: profile.image,
      image: profile.image,
      verified: profile.emailVerified,
      emailVerified: profile.emailVerified,
      socialLinks
    }
  }).pipe(Effect.withSpan('api.user.getProfile'))

  return runEffect<GetProfileRoute>(c, program)
}

export const getSocialLinks: AppRouteHandler<GetSocialLinksRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.getUserSocialLinks(user.id)
  }).pipe(Effect.withSpan('api.user.getSocialLinks'))

  return runEffect<GetSocialLinksRoute>(c, program)
}

export const replaceSocialLinks: AppRouteHandler<ReplaceSocialLinksRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const links = c.req.valid('json')

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.replaceUserSocialLinks(user.id, links)
  }).pipe(Effect.withSpan('api.user.replaceSocialLinks'))

  return runEffect<ReplaceSocialLinksRoute>(c, program)
}

export const getAdminUserSocialLinks: AppRouteHandler<GetAdminUserSocialLinksRoute> = async (c) => {
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
  }).pipe(Effect.withSpan('api.user.getAdminUserSocialLinks'))

  return runEffect<GetAdminUserSocialLinksRoute>(c, program)
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
  }).pipe(Effect.withSpan('api.user.replaceAdminUserSocialLinks'))

  return runEffect<ReplaceAdminUserSocialLinksRoute>(c, program)
}

export const updateAdminUserBio: AppRouteHandler<UpdateAdminUserBioRoute> = async (c) => {
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
  }).pipe(Effect.withSpan('api.user.updateAdminUserBio'))

  return runEffect<UpdateAdminUserBioRoute>(c, program)
}

export const getAdminUserBio: AppRouteHandler<GetAdminUserBioRoute> = async (c) => {
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
  }).pipe(Effect.withSpan('api.user.getAdminUserBio'))

  return runEffect<GetAdminUserBioRoute>(c, program)
}

export const getEmailPreferences: AppRouteHandler<GetEmailPreferencesRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.getUserEmailPreferences(user.id)
  }).pipe(Effect.withSpan('api.user.getEmailPreferences'))

  return runEffect<GetEmailPreferencesRoute>(c, program)
}

export const updateEmailPreferences: AppRouteHandler<UpdateEmailPreferencesRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const updates = c.req.valid('json')

  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.updateUserEmailPreferences(user.id, updates)
  }).pipe(Effect.withSpan('api.user.updateEmailPreferences'))

  return runEffect<UpdateEmailPreferencesRoute>(c, program)
}

export const getUserSubscriptions: AppRouteHandler<GetUserSubscriptionsRoute> = async (c) => {
  const { limit, offset } = c.req.valid('query')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const subscriptionService = yield* ShowSubscriptionService
    return yield* subscriptionService.getUserSubscriptions(user.id, {
      limit,
      offset
    })
  }).pipe(Effect.withSpan('api.user.getSubscriptions'))

  return runEffect<GetUserSubscriptionsRoute>(c, program)
}

export const listDjs: AppRouteHandler<ListDjsRoute> = async (c) => {
  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.listDjs()
  }).pipe(Effect.withSpan('api.user.listDjs'))

  return runEffect<ListDjsRoute>(c, program)
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
  }).pipe(Effect.withSpan('api.user.searchUsers'))

  return runEffect<SearchUsersRoute>(c, program)
}
