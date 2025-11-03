import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'

const tags = ['Email']

export const sendMixNotificationSchema = z.object({
  recipients: z
    .array(z.string().email())
    .min(1, 'At least one recipient is required'),
  mixSlug: z.string().min(1, 'Mix slug is required'),
  metadata: z
    .object({
      username: z.string().optional(),
      mixTitle: z.string().optional(),
      artistName: z.string().optional(),
      coverImageUrl: z.string().url().optional(),
      releaseDate: z.string().optional()
    })
    .optional()
})

export const sendMixNotificationResponseSchema = z.object({
  success: z.boolean(),
  sentTo: z.array(z.string()),
  emailIds: z.array(z.string()),
  message: z.string()
})

export const sendMixNotification = createRoute({
  path: '/send-mix-notification',
  method: 'post',
  request: {
    body: jsonContentRequired(
      sendMixNotificationSchema,
      'Send mix notification email to recipients'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      sendMixNotificationResponseSchema,
      'Emails sent successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Mix not found'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(sendMixNotificationSchema),
      'Validation error'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to send emails'
    )
  }
})

export type SendMixNotificationRoute = typeof sendMixNotification
