import { Effect, Metric } from 'effect'
import { pool } from '@/db'

const requestCount = Metric.counter('request_count', {
  description: 'Total number of requests'
})

const errorCount = Metric.counter('error_count', {
  description: 'Total number of errors'
})

const slowRequestCount = Metric.counter('slow_request_count', {
  description: 'Total number of slow requests (>500ms)'
})

const responseTime = Metric.gauge('response_time_ms', {
  description: 'Most recent response time in milliseconds'
})

const heapUsed = Metric.gauge('heap_used_mb', {
  description: 'Current heap memory usage in MB'
})

const uptime = Metric.gauge('uptime_seconds', {
  description: 'Process uptime in seconds'
})

// Business metrics
const favoriteAddCount = Metric.counter('favorite_add_count', {
  description: 'Total favorites added'
})

const favoriteRemoveCount = Metric.counter('favorite_remove_count', {
  description: 'Total favorites removed'
})

const showSubscribeCount = Metric.counter('show_subscribe_count', {
  description: 'Total show subscriptions'
})

const showUnsubscribeCount = Metric.counter('show_unsubscribe_count', {
  description: 'Total show unsubscriptions'
})

const audioCreateCount = Metric.counter('audio_create_count', {
  description: 'Total audio content created'
})

const emailSendCount = Metric.counter('email_send_count', {
  description: 'Total emails sent'
})

const emailFailCount = Metric.counter('email_fail_count', {
  description: 'Total email send failures'
})

// Database operation gauges
const dbQueryDuration = Metric.gauge('db_query_duration_ms', {
  description: 'Most recent database query duration in milliseconds'
})

const activeConnections = Metric.gauge('active_db_connections', {
  description: 'Current number of active database connections'
})

const SLOW_REQUEST_THRESHOLD = 500

export const recordRequest = (duration: number, isError = false) =>
  Effect.gen(function* () {
    yield* requestCount(Effect.succeed(1))
    yield* responseTime(Effect.succeed(duration))

    if (isError) {
      yield* errorCount(Effect.succeed(1))
    }

    if (duration > SLOW_REQUEST_THRESHOLD) {
      yield* slowRequestCount(Effect.succeed(1))
    }
  })

export const checkPerformanceHealth = Effect.gen(function* () {
  const heapUsedMB = process.memoryUsage().heapUsed / 1024 / 1024
  yield* heapUsed(Effect.succeed(heapUsedMB))
  yield* uptime(Effect.succeed(process.uptime()))
  yield* activeConnections(Effect.succeed(pool.totalCount))

  if (heapUsedMB > 500) {
    yield* Effect.logWarning('[Performance] High memory usage detected', {
      heapUsed: `${Math.round(heapUsedMB)}MB`,
      uptime: `${Math.round(process.uptime())}s`
    })
  }
})

export const recordFavoriteAdd = () => favoriteAddCount(Effect.succeed(1))
export const recordFavoriteRemove = () => favoriteRemoveCount(Effect.succeed(1))
export const recordShowSubscribe = () => showSubscribeCount(Effect.succeed(1))
export const recordShowUnsubscribe = () =>
  showUnsubscribeCount(Effect.succeed(1))
export const recordAudioCreate = () => audioCreateCount(Effect.succeed(1))
export const recordEmailSend = () => emailSendCount(Effect.succeed(1))
export const recordEmailFail = () => emailFailCount(Effect.succeed(1))
export const recordDbQueryDuration = (duration: number) =>
  dbQueryDuration(Effect.succeed(duration))
export const recordActiveConnections = () =>
  activeConnections(Effect.succeed(pool.totalCount))
