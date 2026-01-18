import { eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import {
  type MusicReminder,
  musicReminder,
  type NewMusicReminder
} from '@/db/music-reminder.schema'
import { DatabaseError, NotFoundError, UnauthorizedError } from '@/errors'

export interface MusicReminderService {
  readonly create: (
    data: NewMusicReminder
  ) => Effect.Effect<MusicReminder, DatabaseError>
  readonly getByUserId: (
    userId: string
  ) => Effect.Effect<MusicReminder[], DatabaseError>
  readonly update: (
    id: string,
    userId: string,
    data: Partial<NewMusicReminder>
  ) => Effect.Effect<
    MusicReminder,
    DatabaseError | NotFoundError | UnauthorizedError
  >
  readonly delete: (
    id: string,
    userId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError | UnauthorizedError>
}

export const MusicReminderService = Context.GenericTag<MusicReminderService>(
  'MusicReminderService'
)

const createEffect = (data: NewMusicReminder) =>
  Effect.gen(function* () {
    const records = yield* Effect.tryPromise({
      try: () => db.insert(musicReminder).values(data).returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create music reminder: ${(error as Error).message}`,
          operation: 'insert',
          table: 'music_reminder'
        })
    })

    const record = records[0]
    if (!record) {
      return yield* Effect.fail(
        new DatabaseError({
          message: 'Failed to create music reminder',
          operation: 'insert',
          table: 'music_reminder'
        })
      )
    }

    yield* Effect.logInfo('[MusicReminder] Reminder created', {
      userId: record.userId,
      reminderId: record.id,
      musicTitle: record.musicTitle,
      artistName: record.artistName,
      reminderDate: record.reminderDate.toISOString()
    })

    return record
  })

const getByUserIdEffect = (userId: string) =>
  Effect.gen(function* () {
    const reminders = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicReminder)
          .where(eq(musicReminder.userId, userId))
          .orderBy(musicReminder.reminderDate),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch music reminders: ${(error as Error).message}`,
          operation: 'select',
          table: 'music_reminder'
        })
    })

    yield* Effect.logInfo('[MusicReminder] Reminders retrieved', {
      userId,
      count: reminders.length
    })

    return reminders
  })

const updateEffect = (
  id: string,
  userId: string,
  data: Partial<NewMusicReminder>
) =>
  Effect.gen(function* () {
    const existingRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicReminder)
          .where(eq(musicReminder.id, id))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check reminder existence: ${(error as Error).message}`,
          operation: 'select',
          table: 'music_reminder'
        })
    })

    const existing = existingRecords[0]
    if (!existing) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Music reminder not found',
          resource: 'music_reminder',
          id
        })
      )
    }

    if (existing.userId !== userId) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: 'Unauthorized',
          userId
        })
      )
    }

    const updateValues: Partial<typeof musicReminder.$inferInsert> = {}
    if (data.musicTitle !== undefined) updateValues.musicTitle = data.musicTitle
    if (data.artistName !== undefined) updateValues.artistName = data.artistName
    if (data.musicUrl !== undefined) updateValues.musicUrl = data.musicUrl
    if (data.albumCoverUrl !== undefined)
      updateValues.albumCoverUrl = data.albumCoverUrl
    if (data.reminderDate !== undefined)
      updateValues.reminderDate = data.reminderDate
    if (data.notes !== undefined) updateValues.notes = data.notes

    const updatedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicReminder)
          .set(updateValues)
          .where(eq(musicReminder.id, id))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to update music reminder: ${(error as Error).message}`,
          operation: 'update',
          table: 'music_reminder'
        })
    })

    const updated = updatedRecords[0]
    if (!updated) {
      return yield* Effect.fail(
        new DatabaseError({
          message: 'Failed to update music reminder',
          operation: 'update',
          table: 'music_reminder'
        })
      )
    }

    yield* Effect.logInfo('[MusicReminder] Reminder updated', {
      userId,
      reminderId: updated.id,
      musicTitle: updated.musicTitle,
      artistName: updated.artistName
    })

    return updated
  })

const deleteEffect = (id: string, userId: string) =>
  Effect.gen(function* () {
    const existingRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicReminder)
          .where(eq(musicReminder.id, id))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check reminder existence: ${(error as Error).message}`,
          operation: 'select',
          table: 'music_reminder'
        })
    })

    const existing = existingRecords[0]
    if (!existing) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Music reminder not found',
          resource: 'music_reminder',
          id
        })
      )
    }

    if (existing.userId !== userId) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: 'Unauthorized',
          userId
        })
      )
    }

    yield* Effect.tryPromise({
      try: () => db.delete(musicReminder).where(eq(musicReminder.id, id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to delete music reminder: ${(error as Error).message}`,
          operation: 'delete',
          table: 'music_reminder'
        })
    })

    yield* Effect.logInfo('[MusicReminder] Reminder deleted', {
      userId,
      reminderId: id
    })
  })

export const MusicReminderServiceLive = Layer.succeed(MusicReminderService, {
  create: createEffect,
  getByUserId: getByUserIdEffect,
  update: updateEffect,
  delete: deleteEffect
})
