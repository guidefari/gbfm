import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['Music Reminders']

export const createMusicReminderSchema = z.object({
  musicTitle: z.string().min(1, 'Music title is required'),
  artistName: z.string().min(1, 'Artist name is required'),
  musicUrl: z.string().url('Must be a valid URL'),
  albumCoverUrl: z.string().url().optional(),
  reminderDate: z.string().datetime('Must be a valid date'),
  notes: z.string().optional()
})

export const musicReminderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  musicTitle: z.string(),
  artistName: z.string(),
  musicUrl: z.string(),
  albumCoverUrl: z.string().nullable(),
  reminderDate: z.string(),
  notes: z.string().nullable(),
  status: z.enum(['pending', 'processing', 'sent', 'failed']),
  isSent: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const musicRemindersListSchema = z.array(musicReminderSchema)

export const createMusicReminderResponseSchema = z.object({
  success: z.boolean(),
  reminder: musicReminderSchema,
  message: z.string()
})

export const getMusicRemindersResponseSchema = z.object({
  success: z.boolean(),
  reminders: musicRemindersListSchema,
  total: z.number()
})

export const updateMusicReminderSchema = createMusicReminderSchema.partial()

export const updateMusicReminderResponseSchema = z.object({
  success: z.boolean(),
  reminder: musicReminderSchema,
  message: z.string()
})

export const deleteMusicReminderResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
})

// Create music reminder route
export const createMusicReminder = createRoute({
  path: '/',
  method: 'post',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(createMusicReminderSchema, 'Music reminder data')
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      createMusicReminderResponseSchema,
      'Music reminder created successfully'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Authentication required'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid request data'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to create reminder'
    )
  },
  tags
})

// Get music reminders route
export const getMusicReminders = createRoute({
  path: '/',
  method: 'get',
  middleware: [betterAuthMiddleware],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      getMusicRemindersResponseSchema,
      'Music reminders retrieved successfully'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch reminders'
    )
  },
  tags
})

// Update music reminder route
export const updateMusicReminder = createRoute({
  path: '/:id',
  method: 'put',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonContentRequired(
      updateMusicReminderSchema,
      'Updated music reminder data'
    )
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      updateMusicReminderResponseSchema,
      'Music reminder updated successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Music reminder not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Authentication required'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid request data'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to update reminder'
    )
  },
  tags
})

// Delete music reminder route
export const deleteMusicReminder = createRoute({
  path: '/:id',
  method: 'delete',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      deleteMusicReminderResponseSchema,
      'Music reminder deleted successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Music reminder not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to delete reminder'
    )
  },
  tags
})

export type CreateMusicReminderRoute = typeof createMusicReminder
export type GetMusicRemindersRoute = typeof getMusicReminders
export type UpdateMusicReminderRoute = typeof updateMusicReminder
export type DeleteMusicReminderRoute = typeof deleteMusicReminder
