/**
 * OpenTelemetry Integration Examples
 *
 * This file shows how to integrate OpenTelemetry with various parts of your app.
 * Copy these patterns into your actual code.
 */

// ===================================================================
// Example 1: Initialize in index.ts
// ===================================================================
// apps/vps/src/index.ts

import { initializeTelemetry } from './lib/telemetry'

// IMPORTANT: Initialize BEFORE importing anything else
// This ensures auto-instrumentation captures everything
initializeTelemetry()

// Now import your app
import app from './app'
import { env } from './env'

export default {
  port: env.PORT,
  fetch: app.fetch
}

// ===================================================================
// Example 2: Update create-app.ts
// ===================================================================
// apps/vps/src/lib/create-app.ts

import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { notFound, onError, serveEmojiFavicon } from 'stoker/middlewares'
import { pinoLogger } from '@/middlewares/pino-logger'
import { telemetryMiddleware } from '@/middlewares/telemetry' // Add this

export default function createApp() {
  const app = createRouter()

  app.use('*', cors(corsConfig))

  app
    .use(requestId())
    .use(telemetryMiddleware()) // Add this BEFORE pinoLogger
    .use(pinoLogger())
    .use(serveEmojiFavicon('🪿'))

  app.notFound(notFound)
  app.onError(onError)
  return app
}

// ===================================================================
// Example 3: Add custom spans to route handlers
// ===================================================================
// apps/vps/src/api/mixes/routes.ts

import { withSpan, setSpanAttributes } from '@/middlewares/telemetry'
import { mixMetrics } from '@/lib/telemetry'

// Example: Get mix by ID with custom span
app.get('/mixes/:id', async (c) => {
  const mixId = c.req.param('id')

  // Add context to the current request span
  setSpanAttributes({
    'mix.id': mixId,
    'operation': 'getMix'
  })

  // Create a custom span for the database query
  const mix = await withSpan(
    'db.getMix',
    { 'mix.id': mixId, 'db.table': 'mixes' },
    async () => {
      return await db.query.mixes.findFirst({
        where: eq(mixes.id, mixId)
      })
    }
  )

  if (!mix) {
    return c.json({ error: 'Mix not found' }, 404)
  }

  // Record metric
  mixMetrics.playCount.add(1, {
    'mix.id': mixId,
    'mix.format': mix.format
  })

  return c.json(mix)
})

// Example: Upload mix with detailed instrumentation
app.post('/mixes', async (c) => {
  const body = await c.req.parseBody()
  const file = body.file as File
  const userId = c.get('user')?.id

  setSpanAttributes({
    'user.id': userId,
    'file.size': file.size,
    'file.type': file.type
  })

  const startTime = Date.now()

  try {
    // Upload to S3 with tracing
    const s3Url = await withSpan(
      's3.upload',
      { 'file.size': file.size, 'bucket': 'mixes' },
      async () => {
        return await uploadToS3(file)
      }
    )

    // Create database record with tracing
    const mix = await withSpan(
      'db.createMix',
      { 'user.id': userId },
      async () => {
        return await db.insert(mixes).values({
          userId,
          url: s3Url,
          size: file.size,
          format: file.type
        })
      }
    )

    // Record metrics
    const duration = Date.now() - startTime
    mixMetrics.uploadCount.add(1, { 'user.id': userId, 'format': file.type })
    mixMetrics.fileSize.record(file.size, { 'format': file.type })
    mixMetrics.processingDuration.record(duration, { 'operation': 'upload' })

    return c.json({ success: true, mix })
  } catch (error) {
    // Errors are automatically recorded by the middleware
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// ===================================================================
// Example 4: Instrument cron jobs
// ===================================================================
// apps/vps/src/app.ts

import cron from 'node-cron'
import { instrumentCron } from '@/lib/telemetry/effect'
import { cronMetrics } from '@/lib/telemetry'

// Music reminder cron job with OpenTelemetry
cron.schedule('* * * * *', async () => {
  const startTime = Date.now()

  try {
    console.log('⏰ Starting music reminder cron job...')

    // Wrap the Effect program with instrumentation
    await instrumentCron('music-reminders', processPendingReminders)

    // Record success metrics
    const duration = Date.now() - startTime
    cronMetrics.executionCount.add(1, { 'job': 'music-reminders', 'status': 'success' })
    cronMetrics.executionDuration.record(duration, { 'job': 'music-reminders' })

    console.log('✅ Music reminders sent successfully')
  } catch (error) {
    // Record failure metrics
    const duration = Date.now() - startTime
    cronMetrics.failureCount.add(1, { 'job': 'music-reminders' })
    cronMetrics.executionDuration.record(duration, { 'job': 'music-reminders' })

    console.error('❌ Critical cron error:', error)
  }
})

// ===================================================================
// Example 5: Effect-based services with OpenTelemetry
// ===================================================================
// apps/vps/src/services/reminder-processor.ts

import { Effect } from 'effect'
import { withSpan, setAttributes, addEvent } from '@/lib/telemetry/effect'
import { emailMetrics, cronMetrics } from '@/lib/telemetry'

export const processPendingReminders = withSpan('processPendingReminders', {
  'cron.job': 'music-reminders',
  'service': 'reminder-processor'
})(
  Effect.gen(function* () {
    // Add event for cron start
    yield* addEvent('cron.started', { timestamp: new Date().toISOString() })

    // Fetch pending reminders with tracing
    const reminders = yield* withSpan('fetchPendingReminders', {
      'db.operation': 'select',
      'db.table': 'reminders'
    })(
      Effect.tryPromise(async () => {
        return await db.query.reminders.findMany({
          where: eq(reminders.status, 'pending')
        })
      })
    )

    // Add attributes with reminder count
    yield* setAttributes({
      'reminder.count': reminders.length,
      'reminder.status': 'pending'
    })

    if (reminders.length === 0) {
      yield* addEvent('no_reminders_to_process')
      return
    }

    // Process each reminder
    let successCount = 0
    let failureCount = 0

    yield* Effect.forEach(
      reminders,
      (reminder) =>
        withSpan('sendReminder', {
          'reminder.id': reminder.id,
          'user.id': reminder.userId
        })(
          Effect.gen(function* () {
            try {
              // Send email
              yield* Effect.tryPromise(async () => {
                await sendEmail({
                  to: reminder.email,
                  subject: 'Music Reminder',
                  body: reminder.message
                })
              })

              // Update status
              yield* Effect.tryPromise(async () => {
                await db
                  .update(reminders)
                  .set({ status: 'sent' })
                  .where(eq(reminders.id, reminder.id))
              })

              // Record metrics
              emailMetrics.sentCount.add(1, { type: 'reminder' })
              cronMetrics.remindersSent.add(1)

              successCount++
              yield* addEvent('reminder.sent', { 'reminder.id': reminder.id })
            } catch (error) {
              // Record failure
              emailMetrics.failureCount.add(1, { type: 'reminder' })
              failureCount++
              yield* addEvent('reminder.failed', {
                'reminder.id': reminder.id,
                'error': String(error)
              })
            }
          })
        ),
      { concurrency: 5 } // Process 5 at a time
    )

    // Add final attributes
    yield* setAttributes({
      'reminder.success_count': successCount,
      'reminder.failure_count': failureCount
    })

    yield* addEvent('cron.completed', {
      success: successCount,
      failures: failureCount
    })
  })
)

// ===================================================================
// Example 6: Database query wrapper with tracing
// ===================================================================
// apps/vps/src/db/traced-db.ts

import { drizzle } from 'drizzle-orm/postgres-js'
import { withSpan } from '@/middlewares/telemetry'
import { dbMetrics } from '@/lib/telemetry'
import * as schema from './schema'

// Wrap database queries with automatic tracing
export function tracedQuery<T>(
  name: string,
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()

  return withSpan(
    name,
    {
      'db.system': 'postgresql',
      'db.operation': operation,
      'db.table': table
    },
    async () => {
      try {
        const result = await fn()
        const duration = Date.now() - startTime

        // Record metrics
        dbMetrics.queryCount.add(1, { operation, table })
        dbMetrics.queryDuration.record(duration, { operation, table })

        return result
      } catch (error) {
        const duration = Date.now() - startTime

        // Record error metrics
        dbMetrics.errorCount.add(1, { operation, table })
        dbMetrics.queryDuration.record(duration, { operation, table })

        throw error
      }
    }
  )
}

// Usage example
export async function getUserById(id: string) {
  return tracedQuery('db.getUserById', 'select', 'users', async () => {
    return await db.query.users.findFirst({
      where: eq(users.id, id)
    })
  })
}

// ===================================================================
// Example 7: S3 operations with tracing
// ===================================================================
// apps/vps/src/services/s3-service.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { withSpan } from '@/middlewares/telemetry'
import { storageMetrics } from '@/lib/telemetry'

const s3Client = new S3Client({})

export async function uploadToS3(
  file: File,
  bucket: string,
  key: string
): Promise<string> {
  const startTime = Date.now()

  return withSpan(
    's3.putObject',
    {
      'aws.service': 's3',
      'aws.operation': 'PutObject',
      's3.bucket': bucket,
      's3.key': key,
      'file.size': file.size
    },
    async () => {
      const buffer = await file.arrayBuffer()

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.from(buffer),
          ContentType: file.type
        })
      )

      const duration = Date.now() - startTime

      // Record metrics
      storageMetrics.uploadCount.add(1, { bucket, operation: 'upload' })
      storageMetrics.transferSize.record(file.size, { bucket, operation: 'upload' })
      storageMetrics.operationDuration.record(duration, { bucket, operation: 'upload' })

      return `https://${bucket}.s3.amazonaws.com/${key}`
    }
  )
}

// ===================================================================
// Example 8: Custom business logic with detailed tracing
// ===================================================================
// apps/vps/src/services/mix-processor.ts

import { withSpan, addSpanEvent, setSpanAttributes } from '@/middlewares/telemetry'
import { mixMetrics } from '@/lib/telemetry'

export async function processMixUpload(
  file: File,
  userId: string,
  metadata: MixMetadata
) {
  return withSpan(
    'processMixUpload',
    {
      'user.id': userId,
      'file.size': file.size,
      'mix.format': metadata.format
    },
    async () => {
      // Step 1: Validate file
      addSpanEvent('validation.started')
      const isValid = await validateMixFile(file)
      if (!isValid) {
        addSpanEvent('validation.failed', { reason: 'invalid_format' })
        throw new Error('Invalid file format')
      }
      addSpanEvent('validation.completed')

      // Step 2: Generate thumbnail
      addSpanEvent('thumbnail.generation.started')
      const thumbnail = await withSpan(
        'generateThumbnail',
        { 'file.size': file.size },
        async () => {
          return await generateThumbnail(file)
        }
      )
      addSpanEvent('thumbnail.generation.completed', {
        'thumbnail.size': thumbnail.size
      })

      // Step 3: Upload to S3
      addSpanEvent('s3.upload.started')
      const [audioUrl, thumbnailUrl] = await Promise.all([
        uploadToS3(file, 'mixes', `${userId}/${Date.now()}.mp3`),
        uploadToS3(thumbnail, 'thumbnails', `${userId}/${Date.now()}.jpg`)
      ])
      addSpanEvent('s3.upload.completed')

      // Step 4: Create database record
      addSpanEvent('db.insert.started')
      const mix = await withSpan(
        'db.createMix',
        { 'user.id': userId },
        async () => {
          return await db.insert(mixes).values({
            userId,
            audioUrl,
            thumbnailUrl,
            title: metadata.title,
            description: metadata.description,
            size: file.size,
            format: metadata.format
          })
        }
      )
      addSpanEvent('db.insert.completed', { 'mix.id': mix.id })

      // Record final metrics
      mixMetrics.uploadCount.add(1, {
        'user.id': userId,
        'format': metadata.format
      })
      mixMetrics.fileSize.record(file.size, { 'format': metadata.format })

      // Update span with final context
      setSpanAttributes({
        'mix.id': mix.id,
        'mix.url': audioUrl
      })

      return mix
    }
  )
}
