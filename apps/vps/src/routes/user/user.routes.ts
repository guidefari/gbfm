import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import {
  socialLinkPlatformSchema,
  userSocialLinksSchema
} from '@/db/auth.schema'
import {
  selectAuthorEmailPreferencesSchema,
  updateAuthorEmailPreferencesSchema
} from '@/db/email.schema'
import { subscriptionWithShowSchema } from '@/db/show.schema'
import {
  createPaginatedResponseSchema,
  paginationQuerySchema
} from '@/lib/pagination'

// Better Auth compatible schemas
const selectUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  bio: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  verified: z.boolean().optional(),
  socialLinks: userSocialLinksSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date()
})

const updateProfileSchema = z.object({
  email: z.email().optional(),
  password: z.string().min(8).optional(),
  image: z.string().optional(),
  username: z.string().optional(),
  bio: z.string().max(500).optional(),
  avatar: z.custom<File>().optional().openapi({
    type: 'string',
    format: 'binary',
    description: 'Avatar image file'
  })
})

import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['User']

// Response schemas
const userResponseSchema = selectUserSchema.omit({
  updatedAt: true,
  createdAt: true
})

// User management routes
export const updateProfile = createRoute({
  path: '/profile',
  method: 'patch',
  middleware: [betterAuthMiddleware],
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateProfileSchema
        },
        'multipart/form-data': {
          schema: z.object({
            email: z.email().optional(),
            password: z.string().min(8).optional(),
            username: z.string().optional(),
            bio: z.string().max(500).optional(),
            avatar: z.custom<File>().optional().openapi({
              type: 'string',
              format: 'binary',
              description: 'Avatar image file'
            })
          })
        }
      }
    }
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      userResponseSchema,
      'Profile updated successfully'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid input'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({ error: z.string() }),
      'Forbidden - can only update own profile'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to update profile'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized mf'
    )
  }
})

export const getProfile = createRoute({
  path: '/profile',
  method: 'get',
  middleware: [betterAuthMiddleware],
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      userResponseSchema,
      'Profile retrieved successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({ error: z.string() }),
      'Forbidden - can only get own profile'
    )
  }
})

const socialLinkInputSchema = z.object({
  platform: socialLinkPlatformSchema,
  url: z.string().url(),
  position: z.number().int().nonnegative()
})

export const getSocialLinks = createRoute({
  path: '/profile/social-links',
  method: 'get',
  middleware: [betterAuthMiddleware],
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(socialLinkInputSchema),
      'Social links retrieved successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch social links'
    )
  }
})

export const replaceSocialLinks = createRoute({
  path: '/profile/social-links',
  method: 'put',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(
      z.array(socialLinkInputSchema),
      'Ordered list of social links'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(socialLinkInputSchema),
      'Social links replaced successfully'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid input'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to replace social links'
    )
  }
})

export const getAdminUserSocialLinks = createRoute({
  path: '/admin/{userId}/social-links',
  method: 'get',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'Target user ID' })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(socialLinkInputSchema),
      'Admin social links retrieved successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({ error: z.string() }),
      'Admin access required'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch admin social links'
    )
  }
})

export const replaceAdminUserSocialLinks = createRoute({
  path: '/admin/{userId}/social-links',
  method: 'put',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'Target user ID' })
    }),
    body: jsonContentRequired(
      z.array(socialLinkInputSchema),
      'Ordered list of social links'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(socialLinkInputSchema),
      'Admin social links replaced successfully'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid input'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({ error: z.string() }),
      'Admin access required'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to replace admin social links'
    )
  }
})

export const updateAdminUserBio = createRoute({
  path: '/admin/{userId}/bio',
  method: 'patch',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'Target user ID' })
    }),
    body: jsonContentRequired(
      z.object({
        bio: z.string().max(500).nullable()
      }),
      'User bio update payload'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ bio: z.string().nullable() }),
      'User bio updated'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({ error: z.string() }),
      'Admin access required'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to update admin user bio'
    )
  }
})

export const getAdminUserBio = createRoute({
  path: '/admin/{userId}/bio',
  method: 'get',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'Target user ID' })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ bio: z.string().nullable() }),
      'User bio retrieved'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({ error: z.string() }),
      'Admin access required'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch admin user bio'
    )
  }
})

export const getEmailPreferences = createRoute({
  path: '/email-preferences',
  method: 'get',
  middleware: [betterAuthMiddleware],
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectAuthorEmailPreferencesSchema,
      'Email preferences retrieved successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Email preferences not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Internal server error'
    )
  }
})

export const updateEmailPreferences = createRoute({
  path: '/email-preferences',
  method: 'patch',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(
      updateAuthorEmailPreferencesSchema,
      'Email preferences to update'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectAuthorEmailPreferencesSchema,
      'Email preferences updated successfully'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid input'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to update email preferences'
    )
  }
})

export const getUserSubscriptions = createRoute({
  path: '/subscriptions',
  method: 'get',
  middleware: [betterAuthMiddleware],
  request: {
    query: paginationQuerySchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(subscriptionWithShowSchema),
      'User subscriptions'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch subscriptions'
    )
  }
})

const searchUserResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  image: z.string().nullable()
})

const djListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  image: z.string().nullable(),
  bio: z.string().nullable(),
  mixCount: z.number().int().nonnegative()
})

export const listDjs = createRoute({
  path: '/djs',
  method: 'get',
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(djListItemSchema),
      'List of DJs (users who have published mixes)'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to list DJs'
    )
  }
})

export const searchUsers = createRoute({
  path: '/search',
  method: 'get',
  middleware: [betterAuthMiddleware],
  request: {
    query: z.object({
      q: z.string().min(1).openapi({ description: 'Search query' })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(searchUserResultSchema),
      'Users matching search query'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to search users'
    )
  }
})

export type UpdateProfileRoute = typeof updateProfile
export type GetProfileRoute = typeof getProfile
export type GetSocialLinksRoute = typeof getSocialLinks
export type ReplaceSocialLinksRoute = typeof replaceSocialLinks
export type GetAdminUserSocialLinksRoute = typeof getAdminUserSocialLinks
export type ReplaceAdminUserSocialLinksRoute =
  typeof replaceAdminUserSocialLinks
export type UpdateAdminUserBioRoute = typeof updateAdminUserBio
export type GetAdminUserBioRoute = typeof getAdminUserBio
export type GetEmailPreferencesRoute = typeof getEmailPreferences
export type UpdateEmailPreferencesRoute = typeof updateEmailPreferences
export type GetUserSubscriptionsRoute = typeof getUserSubscriptions
export type ListDjsRoute = typeof listDjs
export type SearchUsersRoute = typeof searchUsers
