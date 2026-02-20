import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'
import { selectEmailDeliveryLogSchema } from '@/db/email.schema'
import {
  createPaginatedResponseSchema,
  paginationQuerySchema
} from '@/lib/pagination'
import { requireAdminMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['Email']
const utcDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

export const emailLogStatusSchema = z.enum([
  'PENDING',
  'SENT',
  'DELIVERED',
  'BOUNCED',
  'COMPLAINED',
  'FAILED'
])

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
  middleware: [requireAdminMiddleware],
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
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({ error: z.string() }),
      'Forbidden'
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

export const emailLogsQuerySchema = paginationQuerySchema
  .extend({
    status: emailLogStatusSchema.optional(),
    recipientEmail: z.string().trim().min(1).optional(),
    dateFrom: utcDateSchema.optional(),
    dateTo: utcDateSchema.optional()
  })
  .refine(
    (value) => {
      if (!value.dateFrom || !value.dateTo) return true
      return new Date(value.dateFrom) <= new Date(value.dateTo)
    },
    {
      message: 'dateFrom must be before or equal to dateTo',
      path: ['dateFrom']
    }
  )

export const getEmailLogs = createRoute({
  path: '/logs',
  method: 'get',
  middleware: [requireAdminMiddleware],
  request: {
    query: emailLogsQuerySchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(selectEmailDeliveryLogSchema),
      'Paginated email delivery logs'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({ error: z.string() }),
      'Forbidden'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(emailLogsQuerySchema),
      'Validation error'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch email logs'
    )
  }
})

export type SendMixNotificationRoute = typeof sendMixNotification
export type GetEmailLogsRoute = typeof getEmailLogs
