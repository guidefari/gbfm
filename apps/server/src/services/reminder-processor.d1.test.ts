import type { D1Database } from '@cloudflare/workers-types'
import { REMINDER_STATUS } from '@gbfm/core/status'
import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { user } from '@/db/auth.schema'
import { emailDeliveryLogsTable } from '@/db/email.schema'
import { Database, DatabaseLayer } from '@/db/layer'
import { musicReminder } from '@/db/music-reminder.schema'
import { ConfigService, createConfig, type WorkerConfigBindings } from '@/services/config.service'
import { EmailDeliveryLive } from '@/services/email-delivery.service'
import {
  EmailTransport,
  EmailUnavailable,
  type OutboundEmailMessage
} from '@/services/email-transport.service'
import { claimReminder, findReminderById, sendClaimedReminder } from '@/services/reminder-processor'
import { createMigratedD1Database } from '@/test/migrate-d1'

const workerBindings = (): WorkerConfigBindings => ({
  APP_STAGE: 'test',
  USER_CONTENT_BUCKET_NAME: 'user-content',
  MIXES_BUCKET_NAME: 'mixes',
  EMAIL_SENDER: 'noreply@mail.goosebumps.fm',
  SpotifyClientId: 'configured',
  SpotifyClientSecret: 'configured',
  DatabaseHost: 'configured',
  DatabaseUser: 'configured',
  DatabasePassword: 'configured',
  DatabasePort: '5432',
  DatabaseName: 'configured',
  SENTRY_BACKEND_DSN: 'configured',
  VITE_PUBLIC_SENTRY_DSN: 'configured',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'configured',
  OTEL_EXPORTER_OTLP_HEADERS: 'configured',
  BETTER_AUTH_SECRET: 'configured',
  BETTER_AUTH_URL: 'configured',
  GBFM_ENCRYPTION_ROOT_KEY: 'configured',
  StorageProvider: 'aws',
  StorageEndpoint: 'configured',
  StorageRegion: 'configured',
  StorageAccessKeyId: 'configured',
  StorageSecretAccessKey: 'configured',
  StorageSigningEndpoint: 'configured'
})

const reminderLayer = (d1: D1Database, messages: Array<OutboundEmailMessage>) => {
  let deliveryAttempts = 0
  const database = DatabaseLayer(d1)
  const transport = Layer.succeed(EmailTransport, {
    send: (message) => {
      messages.push(message)
      deliveryAttempts += 1
      return deliveryAttempts === 1
        ? Effect.fail(new EmailUnavailable({ providerCode: 'unknown' }))
        : Effect.succeed({ provider: 'cloudflare' as const, messageId: 'reminder-accepted' })
    }
  })
  const delivery = EmailDeliveryLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        database,
        transport,
        Layer.succeed(ConfigService, createConfig(workerBindings()))
      )
    )
  )

  return Layer.mergeAll(database, delivery)
}

describe('reminder queue delivery', () => {
  test('reclaims a failed delivery on queue retry and persists the accepted receipt', async () => {
    const d1 = await createMigratedD1Database()
    const database = Effect.runSync(Database.pipe(Effect.provide(DatabaseLayer(d1))))
    const messages: Array<OutboundEmailMessage> = []
    const layer = reminderLayer(d1, messages)
    const userId = crypto.randomUUID()
    const reminderId = crypto.randomUUID()

    await database.insert(user).values({
      id: userId,
      name: 'Reminder listener',
      email: 'reminder-listener@example.com'
    })
    await database.insert(musicReminder).values({
      id: reminderId,
      userId,
      musicTitle: 'A reminder mix',
      artistName: 'Guide Fari',
      musicUrl: 'https://goosebumps.fm/mixes/a-reminder-mix',
      reminderDate: new Date(Date.now() - 1_000)
    })

    const firstClaim = await Effect.runPromise(
      claimReminder(reminderId).pipe(Effect.provide(layer))
    )
    const firstReminder = await Effect.runPromise(
      findReminderById(reminderId).pipe(Effect.provide(layer))
    )
    if (!firstReminder) throw new Error('Test reminder was not found after its first claim')

    await expect(
      Effect.runPromise(sendClaimedReminder(firstReminder).pipe(Effect.provide(layer)))
    ).rejects.toMatchObject({ _tag: 'ReminderProcessingError', stage: 'email' })

    const failedReminder = await database
      .select()
      .from(musicReminder)
      .where(eq(musicReminder.id, reminderId))
    const failedLogs = await database.select().from(emailDeliveryLogsTable)

    expect(firstClaim).toEqual({ claimed: true })
    expect(failedReminder[0]).toMatchObject({ status: REMINDER_STATUS.FAILED, isSent: false })
    expect(failedLogs).toEqual([
      expect.objectContaining({ status: 'FAILED', failureCategory: 'unavailable' })
    ])

    const retryClaim = await Effect.runPromise(
      claimReminder(reminderId).pipe(Effect.provide(layer))
    )
    const retryReminder = await Effect.runPromise(
      findReminderById(reminderId).pipe(Effect.provide(layer))
    )
    if (!retryReminder) throw new Error('Test reminder was not found after its retry claim')

    await Effect.runPromise(sendClaimedReminder(retryReminder).pipe(Effect.provide(layer)))

    const [sentReminder] = await database
      .select()
      .from(musicReminder)
      .where(eq(musicReminder.id, reminderId))
    const logs = await database.select().from(emailDeliveryLogsTable)

    expect(retryClaim).toEqual({ claimed: true })
    expect(messages).toHaveLength(2)
    expect(sentReminder).toMatchObject({ status: REMINDER_STATUS.SENT, isSent: true })
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'FAILED', failureCategory: 'unavailable' }),
        expect.objectContaining({
          status: 'SENT',
          provider: 'cloudflare',
          providerMessageId: 'reminder-accepted'
        })
      ])
    )
  })
})
