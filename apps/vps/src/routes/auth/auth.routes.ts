import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'

import {
  createUserSchema,
  forgotPasswordSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  selectUserSchemaV4,
  signinSchema,
  signupSchema,
  updateProfileSchema
} from '@/db/user.schema'
import {
  paginationQuerySchema,
  createPaginatedResponseSchema
} from '@/lib/pagination'

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, underscores, and hyphens'
  )
  .regex(/^[a-zA-Z]/, 'Username must start with a letter')
  .regex(/[a-zA-Z0-9]$/, 'Username must end with a letter or number')

import { authenticate } from '@/middlewares/auth.middleware'

const tags = ['Auth']

// Response schemas
const authResponseSchema = z.object({
  user: selectUserSchemaV4.omit({ password: true }),
  accessToken: z.string(),
  refreshToken: z.string()
})

const messageResponseSchema = z.object({
  message: z.string()
})

const userResponseSchema = selectUserSchemaV4.omit({
  password: true,
  updatedAt: true,
  verified: true,
  createdAt: true
})

export const signup = createRoute({
  path: '/signup',
  method: 'post',
  request: {
    body: jsonContentRequired(signupSchema, 'User signup data')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        message: z.string(),
        user: userResponseSchema
      }),
      'User created successfully'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Username already taken'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to create user'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(signupSchema),
      'Validation error'
    )
  }
})

export const signin = createRoute({
  path: '/signin',
  method: 'post',
  request: {
    body: jsonContentRequired(signinSchema, 'User signin data')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      authResponseSchema,
      'Successful authentication'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid credentials'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(signinSchema),
      'Validation error'
    )
  }
})

export const forgotPassword = createRoute({
  path: '/forgot-password',
  method: 'post',
  request: {
    body: jsonContentRequired(forgotPasswordSchema, 'Email for password reset')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      messageResponseSchema,
      'Password reset email sent'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(forgotPasswordSchema),
      'Validation error'
    )
  }
})

export const resetPassword = createRoute({
  path: '/reset-password',
  method: 'post',
  request: {
    body: jsonContentRequired(resetPasswordSchema, 'Password reset data')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      messageResponseSchema,
      'Password reset successful'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid request'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid or expired token'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(resetPasswordSchema),
      'Validation error'
    )
  }
})

export const refreshToken = createRoute({
  path: '/refresh-token',
  method: 'post',
  request: {
    body: jsonContentRequired(refreshTokenSchema, 'Refresh token data')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ accessToken: z.string() }),
      'New access token'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Refresh token required'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid refresh token'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(refreshTokenSchema),
      'Validation error'
    )
  }
})

// User management routes
export const createUser = createRoute({
  path: '/users',
  method: 'post',
  request: {
    body: jsonContentRequired(createUserSchema, 'User data')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      userResponseSchema,
      'User created successfully'
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({ error: z.string() }),
      'Username or email already exists'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to create user'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createUserSchema),
      'Validation error'
    )
  }
})

export const listUsers = createRoute({
  path: '/users',
  method: 'get',
  request: {
    query: paginationQuerySchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(userResponseSchema),
      'Paginated list of users'
    )
  }
})

export const updateProfile = createRoute({
  path: '/profile',
  method: 'patch',
  middleware: [authenticate],
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateProfileSchema
        },
        'multipart/form-data': {
          schema: z.object({
            name: z.string().optional(),
            username: usernameSchema.optional(),
            email: z.email().optional(),
            password: z.string().min(8).optional(),
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
  middleware: [authenticate],
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

// Export types for handlers
export type SignupRoute = typeof signup
export type SigninRoute = typeof signin
export type ForgotPasswordRoute = typeof forgotPassword
export type ResetPasswordRoute = typeof resetPassword
export type RefreshTokenRoute = typeof refreshToken
export type CreateUserRoute = typeof createUser
export type ListUsersRoute = typeof listUsers
export type UpdateProfileRoute = typeof updateProfile
export type GetProfileRoute = typeof getProfile
