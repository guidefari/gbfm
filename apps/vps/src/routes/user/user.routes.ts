import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
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
  username: z.string().nullable().optional(),
  displayUsername: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  verified: z.boolean().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
})

const updateProfileSchema = z.object({
  name: z.string().optional(),
  email: z.email().optional(),
  password: z.string().min(8).optional(),
  image: z.string().optional(),
  username: z.string().optional(),
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
            name: z.string().optional(),
            email: z.email().optional(),
            password: z.string().min(8).optional(),
            username: z.string().optional(),
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

export type UpdateProfileRoute = typeof updateProfile
export type GetProfileRoute = typeof getProfile
export type GetEmailPreferencesRoute = typeof getEmailPreferences
export type UpdateEmailPreferencesRoute = typeof updateEmailPreferences
export type GetUserSubscriptionsRoute = typeof getUserSubscriptions
