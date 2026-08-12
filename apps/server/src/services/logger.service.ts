import { isRecord } from '@gbfm/core/utils'
import * as Sentry from '@sentry/core'
import { Effect, Layer, Logger, Option, References, Schema, type LogLevel } from 'effect'
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

type RedactedLogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly RedactedLogValue[]
  | { readonly [key: string]: RedactedLogValue }
type EffectLogMessage = Logger.Options<unknown>['message']

const LogScalar = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null])

function redactValue(value: EffectLogMessage, depth = 0): RedactedLogValue {
  if (depth > 4) return '[Truncated]'
  if (value === undefined) return undefined
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, depth + 1))
  if (isRecord(value)) {
    const out: Record<string, RedactedLogValue> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = PII_KEY_PATTERN.test(k) ? '[Redacted]' : redactValue(v, depth + 1)
    }
    return out
  }
  return Option.getOrElse(Schema.decodeUnknownOption(LogScalar)(value), () => String(value))
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

function formatMessage(value: EffectLogMessage): string {
  const message = Schema.decodeUnknownOption(Schema.String)(value)
  if (Option.isSome(message)) return message.value
  if (Array.isArray(value)) return value.map(formatMessage).join(' ')
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
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
    const payload = isRecord(data) ? Object.assign({}, data, { logLevel }) : { logLevel }

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
