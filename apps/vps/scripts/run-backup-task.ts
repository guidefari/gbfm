import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { sendBackupNotificationEmail } from '@gbfm/email/index'
import * as Sentry from '@sentry/bun'
import { Console, Effect, Exit } from 'effect'
import { config } from '../src/services/config.service'
import {
  type BackupConfig,
  createBackupWithPgDump,
  isPgDumpAvailable,
  withLogCapture
} from './backup-utils'
import { EmailError } from '../src/errors'

/**
 * Task Entrypoint for Database Backup
 *
 * This script runs inside an ECS Task (not Lambda)
 * It has access to pg_dump via the Docker image
 */

const sendNotificationEmail = (
  status: 'success' | 'failure',
  backupConfig: BackupConfig,
  filename: string,
  backupSize: number,
  logs: string,
  errorMessage?: string,
  stackTrace?: string
) =>
  Effect.tryPromise({
    try: () =>
      sendBackupNotificationEmail({
        to: 'guidefari@icloud.com',
        status,
        timestamp: new Date().toISOString(),
        database: backupConfig.database,
        host: `${backupConfig.host}:${backupConfig.port}`,
        filename,
        fileSize: `${(backupSize / 1024 / 1024).toFixed(2)} MB`,
        errorMessage,
        stackTrace,
        logContent: logs,
        stage: process.env.SST_STAGE || 'dev'
      }),
    catch: (error) =>
      error instanceof Error
        ? new EmailError({
            message: `Failed to send email: ${error.message}`,
            emailAddress: 'guidefari@icloud.com'
          })
        : new EmailError({
            message: `Failed to send email: Unknown error: ${String(error)}`,
            emailAddress: 'guidefari@icloud.com'
          })
  }).pipe(
    Effect.tap(() => Console.log(`📧 Notification email sent (${status})`)),
    Effect.catch((error) => Console.error(`Failed to send notification email: ${error}`))
  )

const createBackupEffect = withLogCapture((capture) =>
  Effect.gen(function* () {
    yield* Console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    yield* Console.log('🚀 Database Backup Task Started')
    yield* Console.log(`   Timestamp: ${new Date().toISOString()}`)
    yield* Console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup-${timestamp}.sql`

    const backupConfig: BackupConfig = {
      password: config.database.password,
      user: config.database.user,
      host: config.database.host,
      database: config.database.name,
      port: config.database.port.toString()
    }

    yield* Console.log('📊 Database Configuration:')
    yield* Console.log(`   Database: ${backupConfig.database}`)
    yield* Console.log(`   Host: ${backupConfig.host}:${backupConfig.port}`)
    yield* Console.log(`   User: ${backupConfig.user}`)

    yield* Console.log('\n🔍 Checking for backup tools...')
    const hasPgDump = yield* Effect.promise(() => isPgDumpAvailable())

    if (!hasPgDump) {
      const error = new Error('pg_dump not found in Docker container')
      const logs = yield* capture.getLogs
      yield* sendNotificationEmail(
        'failure',
        backupConfig,
        filename,
        0,
        logs,
        error.message,
        error.stack
      )
      return yield* Effect.die(error)
    }

    yield* Console.log('\n📦 Using pg_dump for backup')
    const sqlDump = yield* Effect.promise(() => createBackupWithPgDump(backupConfig))

    const backupData = Buffer.from(sqlDump)
    const backupSizeMB = (backupData.length / 1024 / 1024).toFixed(2)
    yield* Console.log(`\n✅ Backup created successfully`)
    yield* Console.log(`   Size: ${backupSizeMB} MB`)
    yield* Console.log(`   Filename: ${filename}`)

    yield* Console.log('\n☁️  Uploading to S3...')
    const s3Client = new S3Client({})
    const bucketName = config.buckets.databaseBackups

    yield* Effect.promise(() =>
      s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: filename,
          Body: backupData,
          ContentType: 'application/sql',
          Metadata: {
            timestamp: new Date().toISOString(),
            database: backupConfig.database,
            stage: process.env.SST_STAGE || 'dev',
            method: 'pg_dump',
            source: 'ecs-task'
          }
        })
      )
    )

    yield* Console.log(`\n✅ Upload successful!`)
    yield* Console.log(`   Bucket: ${bucketName}`)
    yield* Console.log(`   Key: ${filename}`)
    yield* Console.log(`   Size: ${backupSizeMB} MB`)

    yield* Console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    yield* Console.log('✅ Backup Task Completed Successfully')
    yield* Console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const logs = yield* capture.getLogs
    yield* sendNotificationEmail('success', backupConfig, filename, backupData.length, logs)

    return {
      success: true,
      filename,
      bucket: bucketName,
      size: backupData.length,
      method: 'pg_dump'
    }
  })
)

const monitorSlug = 'database-backup'
const monitorConfig = {
  schedule: { type: 'crontab' as const, value: '0 2 * * *' },
  checkinMargin: 10,
  maxRuntime: 30,
  timezone: 'UTC',
  failureIssueThreshold: 1,
  recoveryThreshold: 1
}

const finish = async (checkInId: string, status: 'ok' | 'error') => {
  Sentry.captureCheckIn({ monitorSlug, checkInId, status })
  await Sentry.flush(2000)
}

const runBackupTask = async (): Promise<number> => {
  const sentryEnabled = Sentry.getClient() !== undefined
  const checkInId = sentryEnabled
    ? Sentry.captureCheckIn({ monitorSlug, status: 'in_progress' }, monitorConfig)
    : undefined
  const exit = await Effect.runPromiseExit(createBackupEffect)

  if (Exit.isSuccess(exit)) {
    if (checkInId) await finish(checkInId, 'ok')
    return 0
  }

  console.error('Database backup task failed')
  if (checkInId) {
    Sentry.captureException(new Error('Database backup task failed'))
    await finish(checkInId, 'error')
  }
  return 1
}

process.exitCode = await runBackupTask()
