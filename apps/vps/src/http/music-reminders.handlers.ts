import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { MusicReminderService } from '@/services/music-reminder.service'
import { ReminderSignalService } from '@/services/reminder-signal.service'

const dieOnDatabaseError = makeDieOnDatabaseError('music-reminders')

const toReminderResponse = (reminder: {
  id: string
  userId: string
  musicTitle: string
  artistName: string
  musicUrl: string
  albumCoverUrl: string | null
  reminderDate: Date
  notes: string | null
  status: 'pending' | 'processing' | 'sent' | 'failed'
  isSent: boolean
  createdAt: Date
  updatedAt: Date
}) => ({
  ...reminder,
  reminderDate: reminder.reminderDate.toISOString(),
  createdAt: reminder.createdAt.toISOString(),
  updatedAt: reminder.updatedAt.toISOString()
})

export const MusicRemindersHandlersLive = HttpApiBuilder.group(Api, 'music-reminders', (handlers) =>
  handlers
    .handle('createMusicReminder', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* MusicReminderService

        const reminder = yield* dieOnDatabaseError(
          svc.create({
            userId: user.id,
            musicTitle: payload.musicTitle,
            artistName: payload.artistName,
            musicUrl: payload.musicUrl,
            albumCoverUrl: payload.albumCoverUrl ?? null,
            reminderDate: new Date(payload.reminderDate),
            notes: payload.notes ?? null
          })
        )
        const signal = yield* ReminderSignalService
        yield* signal.signal

        return {
          success: true,
          reminder: toReminderResponse(reminder),
          message: 'Music reminder created successfully'
        }
      })
    )
    .handle('getMusicReminders', () =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* MusicReminderService

        const reminders = yield* dieOnDatabaseError(svc.getByUserId(user.id))

        return {
          success: true,
          reminders: reminders.map(toReminderResponse),
          total: reminders.length
        }
      })
    )
    .handle('updateMusicReminder', ({ params, payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* MusicReminderService

        const reminder = yield* dieOnDatabaseError(
          svc
            .update(params.id, user.id, {
              musicTitle: payload.musicTitle,
              artistName: payload.artistName,
              musicUrl: payload.musicUrl,
              albumCoverUrl: payload.albumCoverUrl,
              reminderDate: payload.reminderDate ? new Date(payload.reminderDate) : undefined,
              notes: payload.notes
            })
            .pipe(
              Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
              Effect.catchTag('UnauthorizedError', () => new HttpApiError.Forbidden())
            )
        )
        const signal = yield* ReminderSignalService
        yield* signal.signal

        return {
          success: true,
          reminder: toReminderResponse(reminder),
          message: 'Music reminder updated successfully'
        }
      })
    )
    .handle('deleteMusicReminder', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* MusicReminderService

        yield* dieOnDatabaseError(
          svc.delete(params.id, user.id).pipe(
            Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
            Effect.catchTag('UnauthorizedError', () => new HttpApiError.Forbidden())
          )
        )

        return { success: true, message: 'Music reminder deleted successfully' }
      })
    )
)
