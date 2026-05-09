import * as Sentry from '@sentry/bun'
import { HashMap, Layer, List, Logger, LogLevel } from 'effect'
import pino from 'pino'
import pretty from 'pino-pretty'
import { config } from './config.service'

const REDACT_PATHS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'email',
  '*.password',
  '*.token',
  '*.authorization',
  '*.cookie',
  '*.email',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'accessToken',
  'refreshToken',
  'spotifyAccessToken',
  'betterAuthSession'
]

const PII_KEY_PATTERN =
  /password|token|authorization|cookie|secret|email|session/i

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[Truncated]'
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PII_KEY_PATTERN.test(k)
        ? '[Redacted]'
        : redactValue(v, depth + 1)
    }
    return out
  }
  return value
}

const defaultLevel = config.app.nodeEnv === 'production' ? 'warn' : 'info'

const pinoInstance = pino(
  {
    level: config.app.logLevel || defaultLevel,
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' }
  },
  config.app.nodeEnv === 'production' ? undefined : pretty()
)

const sentryEnabled =
  config.sentry.dsn.length > 0 || process.env.SENTRY_ENABLED === 'true'

function pinoLevel(level: LogLevel.LogLevel): pino.Level {
  switch (level._tag) {
    case 'Trace':
    case 'Debug':
      return 'debug'
    case 'Info':
      return 'info'
    case 'Warning':
      return 'warn'
    case 'Error':
    case 'Fatal':
      return 'error'
    default:
      return 'info'
  }
}

function formatMessage(message: unknown): string {
  if (typeof message === 'string') return message
  if (Array.isArray(message)) return message.map(formatMessage).join(' ')
  try {
    return JSON.stringify(message)
  } catch {
    return String(message)
  }
}

export const AppLogger = Logger.make(
  ({ logLevel, message, annotations, spans, fiberId }) => {
    const msg = formatMessage(message)
    const annotationObj: Record<string, unknown> = {}
    for (const [k, v] of HashMap.entries(annotations)) annotationObj[k] = v
    const data = redactValue(annotationObj) as Record<string, unknown>

    const spanObj: Record<string, number> = {}
    for (const span of List.toArray(spans)) spanObj[span.label] = span.startTime
    const payload = {
      ...data,
      ...(Object.keys(spanObj).length ? { spans: spanObj } : {}),
      fiberId: fiberId.toString()
    }

    pinoInstance[pinoLevel(logLevel)](payload, msg)

    if (!sentryEnabled) return

    const sentryLogger = Sentry.logger
    switch (logLevel._tag) {
      case 'Trace':
      case 'Debug':
        sentryLogger.debug(msg, payload)
        break
      case 'Info':
        sentryLogger.info(msg, payload)
        break
      case 'Warning':
        sentryLogger.warn(msg, payload)
        break
      case 'Error':
        sentryLogger.error(msg, payload)
        break
      case 'Fatal':
        sentryLogger.fatal(msg, payload)
        break
      default:
        sentryLogger.info(msg, payload)
    }
  }
)

export const AppLoggerLive = Layer.mergeAll(
  Logger.replace(Logger.defaultLogger, AppLogger),
  Logger.minimumLogLevel(LogLevel.Info)
)
