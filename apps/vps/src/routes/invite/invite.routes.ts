import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['Invite']

const sendInviteBodySchema = z.object({
  userId: z.string().min(1, 'User ID is required')
})

const sendInviteResponseSchema = z.object({
  success: z.boolean(),
  emailId: z.string()
})

export const sendInvite = createRoute({
  path: '/send',
  method: 'post',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(sendInviteBodySchema, 'Send invite email to user')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      sendInviteResponseSchema,
      'Invite sent successfully'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'User not found'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(sendInviteBodySchema),
      'Validation error'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to send invite'
    )
  }
})

export type SendInviteRoute = typeof sendInvite

const confirmInviteBodySchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
})

const confirmInviteResponseSchema = z.object({
  success: z.boolean()
})

export const confirmInvite = createRoute({
  path: '/confirm',
  method: 'post',
  request: {
    body: jsonContentRequired(
      confirmInviteBodySchema,
      'Confirm invite and set password'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      confirmInviteResponseSchema,
      'Password set and session created'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid or expired token'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to confirm invite'
    )
  }
})

export type ConfirmInviteRoute = typeof confirmInvite
