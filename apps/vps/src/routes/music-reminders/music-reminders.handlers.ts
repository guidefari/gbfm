import { eq } from 'drizzle-orm'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { musicReminder } from '@/db/music-reminder.schema'
import type { AppRouteHandler } from '@/lib/types'

import type {
  CreateMusicReminderRoute,
  DeleteMusicReminderRoute,
  GetMusicRemindersRoute,
  UpdateMusicReminderRoute
} from './music-reminders.routes'

export const createMusicReminder: AppRouteHandler<
  CreateMusicReminderRoute
> = async (c) => {
  const user = c.get('user')

  const {
    musicTitle,
    artistName,
    musicUrl,
    albumCoverUrl,
    reminderDate,
    notes
  } = c.req.valid('json')

  const [newReminder] = await db
    .insert(musicReminder)
    .values({
      userId: user.id,
      musicTitle,
      artistName,
      musicUrl,
      albumCoverUrl: albumCoverUrl || null,
      reminderDate: new Date(reminderDate),
      notes: notes || null
    })
    .returning()

  if (!newReminder) {
    return c.json(
      { error: 'Failed to create reminder' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json(
    {
      success: true,
      reminder: {
        ...newReminder,
        reminderDate: newReminder.reminderDate.toISOString(),
        createdAt: newReminder.createdAt.toISOString(),
        updatedAt: newReminder.updatedAt.toISOString()
      },
      message: 'Music reminder created successfully'
    },
    HttpStatusCodes.CREATED
  )
}

// @ts-expect-error - OpenAPI type system creates strict union types that don't match Hono's flexible return types
export const getMusicReminders: AppRouteHandler<
  GetMusicRemindersRoute
> = async (c) => {
  const user = c.get('user')
  console.log('user:', user)

  const reminders = await db
    .select()
    .from(musicReminder)
    .where(eq(musicReminder.userId, user.id))
    .orderBy(musicReminder.reminderDate)

  const formattedReminders = reminders.map((reminder) => ({
    ...reminder,
    reminderDate: reminder.reminderDate.toISOString(),
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString()
  }))

  return c.json({
    success: true,
    reminders: formattedReminders,
    total: reminders.length
  })
}

// @ts-expect-error - OpenAPI type system creates strict union types that don't match Hono's flexible return types
export const updateMusicReminder: AppRouteHandler<
  UpdateMusicReminderRoute
> = async (c) => {
  const user = c.get('user')

  const { id } = c.req.valid('param')
  const updateData = c.req.valid('json')

  // First check if the reminder exists and belongs to the user
  const [existingReminder] = await db
    .select()
    .from(musicReminder)
    .where(eq(musicReminder.id, id))
    .limit(1)

  if (!existingReminder) {
    return c.json(
      { error: 'Music reminder not found' },
      HttpStatusCodes.NOT_FOUND
    )
  }

  if (existingReminder.userId !== user.id) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const updateValues: Partial<typeof musicReminder.$inferInsert> = {}

  if (updateData.musicTitle !== undefined)
    updateValues.musicTitle = updateData.musicTitle
  if (updateData.artistName !== undefined)
    updateValues.artistName = updateData.artistName
  if (updateData.musicUrl !== undefined)
    updateValues.musicUrl = updateData.musicUrl
  if (updateData.albumCoverUrl !== undefined)
    updateValues.albumCoverUrl = updateData.albumCoverUrl
  if (updateData.reminderDate !== undefined)
    updateValues.reminderDate = new Date(updateData.reminderDate)
  if (updateData.notes !== undefined) updateValues.notes = updateData.notes

  const [updatedReminder] = await db
    .update(musicReminder)
    .set(updateValues)
    .where(eq(musicReminder.id, id))
    .returning()

  if (!updatedReminder) {
    return c.json(
      { error: 'Failed to update reminder' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json({
    success: true,
    reminder: {
      ...updatedReminder,
      reminderDate: updatedReminder.reminderDate.toISOString(),
      createdAt: updatedReminder.createdAt.toISOString(),
      updatedAt: updatedReminder.updatedAt.toISOString()
    },
    message: 'Music reminder updated successfully'
  })
}

// @ts-expect-error - OpenAPI type system creates strict union types that don't match Hono's flexible return types
export const deleteMusicReminder: AppRouteHandler<
  DeleteMusicReminderRoute
> = async (c) => {
  const user = c.get('user')

  const { id } = c.req.valid('param')

  // First check if the reminder exists and belongs to the user
  const [existingReminder] = await db
    .select()
    .from(musicReminder)
    .where(eq(musicReminder.id, id))
    .limit(1)

  if (!existingReminder) {
    return c.json(
      { error: 'Music reminder not found' },
      HttpStatusCodes.NOT_FOUND
    )
  }

  if (existingReminder.userId !== user.id) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  await db.delete(musicReminder).where(eq(musicReminder.id, id))

  return c.json({
    success: true,
    message: 'Music reminder deleted successfully'
  })
}
