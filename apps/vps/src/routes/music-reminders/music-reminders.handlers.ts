import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
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
  ).pipe(
    Effect.map(
      (newReminder) =>
        ({
          data: {
            success: true,
            reminder: {
              ...newReminder,
              reminderDate: newReminder.reminderDate.toISOString(),
              createdAt: newReminder.createdAt.toISOString(),
              updatedAt: newReminder.updatedAt.toISOString()
            },
            message: 'Music reminder created successfully'
          },
          status: HttpStatusCodes.CREATED
        }) as const
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to create reminder',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}

export const getMusicReminders: AppRouteHandler<
  GetMusicRemindersRoute
> = async (c) => {
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const service = yield* MusicReminderService
    return yield* service.getByUserId(user.id)
  }).pipe(
    Effect.map((reminders) => {
      const formattedReminders = reminders.map((reminder) => ({
        ...reminder,
        reminderDate: reminder.reminderDate.toISOString(),
        createdAt: reminder.createdAt.toISOString(),
        updatedAt: reminder.updatedAt.toISOString()
      }))
      return {
        data: {
          success: true,
          reminders: formattedReminders,
          total: reminders.length
        },
        status: HttpStatusCodes.OK
      } as const
    }),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to fetch reminders',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
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
  }).pipe(
    Effect.map(
      (updatedReminder) =>
        ({
          data: {
            success: true,
            reminder: {
              ...updatedReminder,
              reminderDate: updatedReminder.reminderDate.toISOString(),
              createdAt: updatedReminder.createdAt.toISOString(),
              updatedAt: updatedReminder.updatedAt.toISOString()
            },
            message: 'Music reminder updated successfully'
          },
          status: HttpStatusCodes.OK
        }) as const
    ),
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed({
        error: 'Music reminder not found',
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('UnauthorizedError', () =>
      Effect.succeed({
        error: 'Unauthorized',
        status: HttpStatusCodes.UNAUTHORIZED
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to update reminder',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}

export const deleteMusicReminder: AppRouteHandler<
  DeleteMusicReminderRoute
> = async (c) => {
  const user = c.get('user')
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const service = yield* MusicReminderService
    return yield* service.delete(id, user.id)
  }).pipe(
    Effect.map(
      () =>
        ({
          data: {
            success: true,
            message: 'Music reminder deleted successfully'
          },
          status: HttpStatusCodes.OK
        }) as const
    ),
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed({
        error: 'Music reminder not found',
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('UnauthorizedError', () =>
      Effect.succeed({
        error: 'Unauthorized',
        status: HttpStatusCodes.UNAUTHORIZED
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to delete reminder',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}
