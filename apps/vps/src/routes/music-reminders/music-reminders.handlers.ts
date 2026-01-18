import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { DatabaseError, NotFoundError, UnauthorizedError } from '@/errors'
import type { AppRouteHandler } from '@/lib/types'
import { runApp } from '@/runtime'
import { MusicReminderService } from '@/services/music-reminder.service'

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

  const program = Effect.withSpan('api.music-reminder.create', {
    attributes: {
      userId: user.id,
      musicTitle,
      artistName,
      method: 'POST',
      path: '/music-reminders'
    }
  })(
    Effect.gen(function* () {
      // Add additional span annotations
      yield* Effect.annotateCurrentSpan('hasAlbumCover', !!albumCoverUrl)
      yield* Effect.annotateCurrentSpan('hasNotes', !!notes)
      const service = yield* MusicReminderService
      return yield* service.create({
        userId: user.id,
        musicTitle,
        artistName,
        musicUrl,
        albumCoverUrl: albumCoverUrl || null,
        reminderDate: new Date(reminderDate),
        notes: notes || null
      })
    })
  )

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    if (error instanceof DatabaseError) {
      return c.json(
        { error: 'Failed to create reminder' },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      )
    }
    return c.json(
      { error: 'An unexpected error occurred' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  const newReminder = result.right
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

export const getMusicReminders: AppRouteHandler<
  GetMusicRemindersRoute
> = async (c) => {
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const service = yield* MusicReminderService
    return yield* service.getByUserId(user.id)
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return c.json(
      { error: 'Failed to fetch reminders' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  const reminders = result.right
  const formattedReminders = reminders.map((reminder) => ({
    ...reminder,
    reminderDate: reminder.reminderDate.toISOString(),
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString()
  }))

  return c.json(
    {
      success: true,
      reminders: formattedReminders,
      total: reminders.length
    },
    HttpStatusCodes.OK
  )
}

export const updateMusicReminder: AppRouteHandler<
  UpdateMusicReminderRoute
> = async (c) => {
  const user = c.get('user')
  const { id } = c.req.valid('param')
  const updateData = c.req.valid('json')

  const program = Effect.gen(function* () {
    const service = yield* MusicReminderService
    return yield* service.update(id, user.id, {
      musicTitle: updateData.musicTitle,
      artistName: updateData.artistName,
      musicUrl: updateData.musicUrl,
      albumCoverUrl: updateData.albumCoverUrl,
      reminderDate: updateData.reminderDate
        ? new Date(updateData.reminderDate)
        : undefined,
      notes: updateData.notes
    })
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    if (error instanceof NotFoundError) {
      return c.json(
        { error: 'Music reminder not found' },
        HttpStatusCodes.NOT_FOUND
      )
    }
    if (error instanceof UnauthorizedError) {
      return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
    }
    return c.json(
      { error: 'Failed to update reminder' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  const updatedReminder = result.right
  return c.json(
    {
      success: true,
      reminder: {
        ...updatedReminder,
        reminderDate: updatedReminder.reminderDate.toISOString(),
        createdAt: updatedReminder.createdAt.toISOString(),
        updatedAt: updatedReminder.updatedAt.toISOString()
      },
      message: 'Music reminder updated successfully'
    },
    HttpStatusCodes.OK
  )
}

export const deleteMusicReminder: AppRouteHandler<
  DeleteMusicReminderRoute
> = async (c) => {
  const user = c.get('user')
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const service = yield* MusicReminderService
    return yield* service.delete(id, user.id)
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    if (error instanceof NotFoundError) {
      return c.json(
        { error: 'Music reminder not found' },
        HttpStatusCodes.NOT_FOUND
      )
    }
    if (error instanceof UnauthorizedError) {
      return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
    }
    return c.json(
      { error: 'Failed to delete reminder' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json(
    {
      success: true,
      message: 'Music reminder deleted successfully'
    },
    HttpStatusCodes.OK
  )
}
