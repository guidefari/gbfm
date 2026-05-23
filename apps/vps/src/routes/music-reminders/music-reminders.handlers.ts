import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { runEffect } from '@/lib/effect-hono'
import type { AppRouteHandler } from '@/lib/types'
import { MusicReminderService } from '@/services/music-reminder.service'
import { ReminderSignalService } from '@/services/reminder-signal.service'

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
      yield* Effect.annotateCurrentSpan('hasAlbumCover', Boolean(albumCoverUrl))
      yield* Effect.annotateCurrentSpan('hasNotes', Boolean(notes))
      const service = yield* MusicReminderService
      const result = yield* service.create({
        userId: user.id,
        musicTitle,
        artistName,
        musicUrl,
        albumCoverUrl: albumCoverUrl || null,
        reminderDate: new Date(reminderDate),
        notes: notes || null
      })
      const signal = yield* ReminderSignalService
      yield* signal.signal
      return {
        success: true,
        reminder: {
          ...result,
          reminderDate: result.reminderDate.toISOString(),
          createdAt: result.createdAt.toISOString(),
          updatedAt: result.updatedAt.toISOString()
        },
        message: 'Music reminder created successfully'
      } as const
    })
  )

  return runEffect<CreateMusicReminderRoute>(
    c,
    program,
    HttpStatusCodes.CREATED
  )
}

export const getMusicReminders: AppRouteHandler<
  GetMusicRemindersRoute
> = async (c) => {
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const service = yield* MusicReminderService
    const reminders = yield* service.getByUserId(user.id)
    return {
      success: true,
      reminders: reminders.map((r) => ({
        ...r,
        reminderDate: r.reminderDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      })),
      total: reminders.length
    } as const
  })

  return runEffect<GetMusicRemindersRoute>(c, program)
}

export const updateMusicReminder: AppRouteHandler<
  UpdateMusicReminderRoute
> = async (c) => {
  const user = c.get('user')
  const { id } = c.req.valid('param')
  const updateData = c.req.valid('json')

  const program = Effect.gen(function* () {
    const service = yield* MusicReminderService
    const result = yield* service.update(id, user.id, {
      musicTitle: updateData.musicTitle,
      artistName: updateData.artistName,
      musicUrl: updateData.musicUrl,
      albumCoverUrl: updateData.albumCoverUrl,
      reminderDate: updateData.reminderDate
        ? new Date(updateData.reminderDate)
        : undefined,
      notes: updateData.notes
    })
    const signal = yield* ReminderSignalService
    yield* signal.signal
    return {
      success: true,
      reminder: {
        ...result,
        reminderDate: result.reminderDate.toISOString(),
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString()
      },
      message: 'Music reminder updated successfully'
    } as const
  })

  return runEffect<UpdateMusicReminderRoute>(c, program)
}

export const deleteMusicReminder: AppRouteHandler<
  DeleteMusicReminderRoute
> = async (c) => {
  const user = c.get('user')
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const service = yield* MusicReminderService
    yield* service.delete(id, user.id)
    return {
      success: true,
      message: 'Music reminder deleted successfully'
    } as const
  })

  return runEffect<DeleteMusicReminderRoute>(c, program)
}
