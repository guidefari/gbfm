import * as Sentry from '@sentry/core'
import { Effect, Metric } from 'effect'

const SLOW_REQUEST_THRESHOLD = 500

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
const dbQueryDuration = Metric.gauge('db_query_duration_ms', {
  description: 'Most recent database query duration in milliseconds'
})
const mirrorCount = (name: string, value = 1) =>
  Effect.sync(() => {
    if (!Sentry.getClient()) return
    Sentry.metrics.count(name, value)
  })

const mirrorGauge = (name: string, value: number, unit?: string) =>
  Effect.sync(() => {
    if (!Sentry.getClient()) return
    Sentry.metrics.gauge(name, value, unit ? { unit } : undefined)
  })

const mirrorDistribution = (name: string, value: number, unit?: string) =>
  Effect.sync(() => {
    if (!Sentry.getClient()) return
    Sentry.metrics.distribution(name, value, unit ? { unit } : undefined)
  })

export const recordRequest = (duration: number, isError = false) =>
  Effect.gen(function* () {
    yield* Metric.update(requestCount, 1)
    yield* Metric.update(responseTime, duration)
    yield* mirrorCount('request_count')
    yield* mirrorDistribution('response_time_ms', duration, 'millisecond')

    if (isError) {
      yield* Metric.update(errorCount, 1)
      yield* mirrorCount('error_count')
    }

    if (duration > SLOW_REQUEST_THRESHOLD) {
      yield* Metric.update(slowRequestCount, 1)
      yield* mirrorCount('slow_request_count')
    }
  })

export const checkPerformanceHealth = Effect.gen(function* () {
  const heapUsedMB = process.memoryUsage().heapUsed / 1024 / 1024
  yield* Metric.update(heapUsed, heapUsedMB)
  yield* Metric.update(uptime, process.uptime())
  yield* mirrorGauge('heap_used_mb', heapUsedMB, 'megabyte')
  yield* mirrorGauge('uptime_seconds', process.uptime(), 'second')

  if (heapUsedMB > 500) {
    yield* Effect.logWarning('[Performance] High memory usage detected', {
      heapUsed: `${Math.round(heapUsedMB)}MB`,
      uptime: `${Math.round(process.uptime())}s`
    })
  }
})

export const recordFavoriteAdd = Effect.andThen(
  Metric.update(favoriteAddCount, 1),
  mirrorCount('favorite_add_count')
)
export const recordFavoriteRemove = Effect.andThen(
  Metric.update(favoriteRemoveCount, 1),
  mirrorCount('favorite_remove_count')
)
export const recordShowSubscribe = Effect.andThen(
  Metric.update(showSubscribeCount, 1),
  mirrorCount('show_subscribe_count')
)
export const recordShowUnsubscribe = Effect.andThen(
  Metric.update(showUnsubscribeCount, 1),
  mirrorCount('show_unsubscribe_count')
)
export const recordAudioCreate = Effect.andThen(
  Metric.update(audioCreateCount, 1),
  mirrorCount('audio_create_count')
)
export const recordEmailSend = Effect.andThen(
  Metric.update(emailSendCount, 1),
  mirrorCount('email_send_count')
)
export const recordEmailFail = Effect.andThen(
  Metric.update(emailFailCount, 1),
  mirrorCount('email_fail_count')
)
export const recordDbQueryDuration = (duration: number) =>
  Effect.andThen(
    Metric.update(dbQueryDuration, duration),
    mirrorDistribution('db_query_duration_ms', duration, 'millisecond')
  )
