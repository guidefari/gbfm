/**
 * Custom Business Metrics
 *
 * Define application-specific metrics here.
 * These metrics will be exported to your configured backend.
 */

import { getMeter } from './init'

const meter = getMeter('gbfm-business-metrics')

/**
 * HTTP Request Metrics
 */
export const httpMetrics = {
  // Counter for total requests
  requestCount: meter.createCounter('http.requests.total', {
    description: 'Total number of HTTP requests',
    unit: '1'
  }),

  // Counter for errors
  errorCount: meter.createCounter('http.errors.total', {
    description: 'Total number of HTTP errors',
    unit: '1'
  }),

  // Histogram for request duration
  requestDuration: meter.createHistogram('http.request.duration', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms'
  }),

  // Histogram for response size
  responseSize: meter.createHistogram('http.response.size', {
    description: 'HTTP response size in bytes',
    unit: 'bytes'
  })
}

/**
 * Database Metrics
 */
export const dbMetrics = {
  // Counter for queries
  queryCount: meter.createCounter('db.queries.total', {
    description: 'Total number of database queries',
    unit: '1'
  }),

  // Histogram for query duration
  queryDuration: meter.createHistogram('db.query.duration', {
    description: 'Database query duration in milliseconds',
    unit: 'ms'
  }),

  // Counter for connection pool
  connectionPoolSize: meter.createUpDownCounter('db.connection_pool.size', {
    description: 'Current database connection pool size',
    unit: '1'
  }),

  // Counter for errors
  errorCount: meter.createCounter('db.errors.total', {
    description: 'Total number of database errors',
    unit: '1'
  })
}

/**
 * Business Metrics - Mixes
 */
export const mixMetrics = {
  // Counter for uploads
  uploadCount: meter.createCounter('mix.uploads.total', {
    description: 'Total number of mix uploads',
    unit: '1'
  }),

  // Counter for plays/downloads
  playCount: meter.createCounter('mix.plays.total', {
    description: 'Total number of mix plays',
    unit: '1'
  }),

  // Histogram for file size
  fileSize: meter.createHistogram('mix.file.size', {
    description: 'Mix file size in bytes',
    unit: 'bytes'
  }),

  // Histogram for processing duration
  processingDuration: meter.createHistogram('mix.processing.duration', {
    description: 'Mix processing duration in milliseconds',
    unit: 'ms'
  }),

  // Current active mixes
  activeMixes: meter.createUpDownCounter('mix.active', {
    description: 'Number of active mixes',
    unit: '1'
  })
}

/**
 * Email Metrics
 */
export const emailMetrics = {
  // Counter for emails sent
  sentCount: meter.createCounter('email.sent.total', {
    description: 'Total number of emails sent',
    unit: '1'
  }),

  // Counter for email failures
  failureCount: meter.createCounter('email.failures.total', {
    description: 'Total number of email failures',
    unit: '1'
  }),

  // Histogram for send duration
  sendDuration: meter.createHistogram('email.send.duration', {
    description: 'Email send duration in milliseconds',
    unit: 'ms'
  })
}

/**
 * Reminder/Cron Metrics
 */
export const cronMetrics = {
  // Counter for job executions
  executionCount: meter.createCounter('cron.executions.total', {
    description: 'Total number of cron job executions',
    unit: '1'
  }),

  // Counter for job failures
  failureCount: meter.createCounter('cron.failures.total', {
    description: 'Total number of cron job failures',
    unit: '1'
  }),

  // Histogram for execution duration
  executionDuration: meter.createHistogram('cron.execution.duration', {
    description: 'Cron job execution duration in milliseconds',
    unit: 'ms'
  }),

  // Counter for reminders sent
  remindersSent: meter.createCounter('reminders.sent.total', {
    description: 'Total number of reminders sent',
    unit: '1'
  })
}

/**
 * User Metrics
 */
export const userMetrics = {
  // Counter for registrations
  registrationCount: meter.createCounter('user.registrations.total', {
    description: 'Total number of user registrations',
    unit: '1'
  }),

  // Counter for logins
  loginCount: meter.createCounter('user.logins.total', {
    description: 'Total number of user logins',
    unit: '1'
  }),

  // Active sessions
  activeSessions: meter.createUpDownCounter('user.sessions.active', {
    description: 'Number of active user sessions',
    unit: '1'
  }),

  // Counter for failed logins
  failedLoginCount: meter.createCounter('user.logins.failed.total', {
    description: 'Total number of failed login attempts',
    unit: '1'
  })
}

/**
 * S3/Storage Metrics
 */
export const storageMetrics = {
  // Counter for uploads
  uploadCount: meter.createCounter('storage.uploads.total', {
    description: 'Total number of file uploads to S3',
    unit: '1'
  }),

  // Counter for downloads
  downloadCount: meter.createCounter('storage.downloads.total', {
    description: 'Total number of file downloads from S3',
    unit: '1'
  }),

  // Histogram for transfer size
  transferSize: meter.createHistogram('storage.transfer.size', {
    description: 'Storage transfer size in bytes',
    unit: 'bytes'
  }),

  // Histogram for operation duration
  operationDuration: meter.createHistogram('storage.operation.duration', {
    description: 'Storage operation duration in milliseconds',
    unit: 'ms'
  })
}

/**
 * Helper function to record HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number,
  responseSizeBytes?: number
) {
  const attributes = {
    'http.method': method,
    'http.route': route,
    'http.status_code': statusCode
  }

  httpMetrics.requestCount.add(1, attributes)
  httpMetrics.requestDuration.record(durationMs, attributes)

  if (statusCode >= 400) {
    httpMetrics.errorCount.add(1, {
      ...attributes,
      'error.type': statusCode >= 500 ? 'server_error' : 'client_error'
    })
  }

  if (responseSizeBytes) {
    httpMetrics.responseSize.record(responseSizeBytes, attributes)
  }
}

/**
 * Helper function to record database query metrics
 */
export function recordDbQuery(
  operation: string,
  table: string,
  durationMs: number,
  success: boolean
) {
  const attributes = {
    'db.operation': operation,
    'db.table': table
  }

  dbMetrics.queryCount.add(1, attributes)
  dbMetrics.queryDuration.record(durationMs, attributes)

  if (!success) {
    dbMetrics.errorCount.add(1, attributes)
  }
}
