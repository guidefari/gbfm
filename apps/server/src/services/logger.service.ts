import { isRecord } from '@gbfm/core/utils'
import * as Sentry from '@sentry/core'
import { Effect, Layer, Logger, References, type LogLevel } from 'effect'
import pino from 'pino'
import pretty from 'pino-pretty'
import { ConfigService } from './config.service'

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

const PII_KEY_PATTERN = /password|token|authorization|cookie|secret|email|session/i

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[Truncated]'
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1))
  if (isRecord(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = PII_KEY_PATTERN.test(k) ? '[Redacted]' : redactValue(v, depth + 1)
    }
    return out
  }
  return value
}

const makePinoLogger = (nodeEnv: string, logLevel: string | undefined) =>
  pino(
    {
      level: logLevel || (nodeEnv === 'production' ? 'warn' : 'info'),
      redact: { paths: REDACT_PATHS, censor: '[Redacted]' }
    },
    nodeEnv === 'production' ? undefined : pretty()
  )

function pinoLevel(level: LogLevel.LogLevel): pino.Level {
  switch (level) {
    case 'Trace':
    case 'Debug':
      return 'debug'
    case 'Info':
      return 'info'
    case 'Warn':
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

const makeAppLogger = (pinoInstance: pino.Logger) =>
  Logger.make(({ logLevel, message, cause, fiber, date }) => {
    const msg = formatMessage(message)
    const data = redactValue({
      annotations: fiber.getRef(References.CurrentLogAnnotations),
      cause,
      fiberId: fiber.id,
      date
    })
    const payload = {
      ...(isRecord(data) ? data : {}),
      logLevel
    }

    pinoInstance[pinoLevel(logLevel)](payload, msg)

    if (!Sentry.getClient() || ['Trace', 'Debug', 'Info'].includes(logLevel)) return

    const sentryLogger = Sentry.logger
    switch (logLevel) {
      case 'Trace':
      case 'Debug':
        sentryLogger.debug(msg, payload)
        break
      case 'Info':
        sentryLogger.info(msg, payload)
        break
      case 'Warn':
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
  })

export const AppLoggerLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ConfigService
    return Logger.layer([makeAppLogger(makePinoLogger(config.app.nodeEnv, config.app.logLevel))])
  })
)
